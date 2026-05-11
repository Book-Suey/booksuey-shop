import crypto from 'crypto'
import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { AuditEvent } from '../../models/AuditEvent'
import { LedgerEntry } from '../../models/LedgerEntry'
import { PaymentDisbursement } from '../../models/PaymentDisbursement'
import { PayoutRequest } from '../../models/PayoutRequest'
import { Vendor } from '../../models/Vendor'
import { recomputeBalanceSnapshot } from '../../utils/balance'
import { requireAdmin } from '../../utils/adminAuth'
import { executePayout, mapVendorToPayout } from '../../utils/payoutExecution'
import { runWithOptionalTransaction } from '../../utils/transactions'

const createDisbursementSchema = z.object({
  payoutRequestId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(200),
  methodType: z.enum(['paypal', 'venmo']).optional()
})

function createAuditId(): string {
  return `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

async function buildExistingDisbursementResponse(input: {
  existingDisbursement: {
    disbursementId: string
    payoutRequestId: string
    methodType: string
    providerReferenceId: string
    providerItemId?: string
    amount: { toString: () => string }
    currency: string
    status: string
    disbursedAt?: Date
    failureReason?: string
    createdAt: Date
    updatedAt: Date
  }
  payoutRequestId: string
  idempotentReplay?: boolean
  alreadyInProgress?: boolean
  alreadyCompleted?: boolean
}) {
  const payout = await PayoutRequest.findOne({ payoutRequestId: input.payoutRequestId })
  const vendor = payout ? await Vendor.findOne({ vendorId: payout.vendorId }) : null
  const balance = payout
    ? await recomputeBalanceSnapshot(
        payout.vendorId,
        vendor?.approvedVendorId || payout.vendorId
      )
    : null

  return {
    idempotentReplay: !!input.idempotentReplay,
    alreadyInProgress: !!input.alreadyInProgress,
    alreadyCompleted: !!input.alreadyCompleted,
    disbursement: {
      disbursementId: input.existingDisbursement.disbursementId,
      payoutRequestId: input.existingDisbursement.payoutRequestId,
      methodType: input.existingDisbursement.methodType,
      providerReferenceId: input.existingDisbursement.providerReferenceId,
      providerItemId: input.existingDisbursement.providerItemId,
      amount: input.existingDisbursement.amount.toString(),
      currency: input.existingDisbursement.currency,
      status: input.existingDisbursement.status,
      disbursedAt: input.existingDisbursement.disbursedAt,
      failureReason: input.existingDisbursement.failureReason,
      createdAt: input.existingDisbursement.createdAt,
      updatedAt: input.existingDisbursement.updatedAt
    },
    payoutRequest: payout
      ? {
          payoutRequestId: payout.payoutRequestId,
          status: payout.status,
          disbursingAt: payout.disbursingAt,
          paidAt: payout.paidAt,
          failedAt: payout.failedAt,
          updatedAt: payout.updatedAt
        }
      : null,
    balance: balance
      ? {
          pendingAmount: balance.pendingAmount,
          availableAmount: balance.availableAmount,
          paidAmount: balance.paidAmount,
          asOf: balance.asOf
        }
      : null
  }
}

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const body = await readBody(event)
  const parsedBody = createDisbursementSchema.safeParse(body)

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid disbursement request payload'
    })
  }

  const payload = parsedBody.data

  const existingDisbursement = await PaymentDisbursement.findOne({
    payoutRequestId: payload.payoutRequestId,
    idempotencyKey: payload.idempotencyKey
  })

  if (existingDisbursement) {
    return await buildExistingDisbursementResponse({
      existingDisbursement,
      payoutRequestId: payload.payoutRequestId,
      idempotentReplay: true
    })
  }

  const inProgressPayout = await PayoutRequest.findOne({
    payoutRequestId: payload.payoutRequestId,
    status: 'disbursing'
  })

  if (inProgressPayout) {
    const inProgressDisbursement = await PaymentDisbursement.findOne({
      payoutRequestId: payload.payoutRequestId,
      status: 'disbursing'
    }).sort({ createdAt: -1 })

    if (inProgressDisbursement) {
      return await buildExistingDisbursementResponse({
        existingDisbursement: inProgressDisbursement,
        payoutRequestId: payload.payoutRequestId,
        alreadyInProgress: true
      })
    }
  }

  const completedPayout = await PayoutRequest.findOne({
    payoutRequestId: payload.payoutRequestId,
    status: 'paid'
  })

  if (completedPayout) {
    const completedDisbursement = await PaymentDisbursement.findOne({
      payoutRequestId: payload.payoutRequestId
    }).sort({ createdAt: -1 })

    if (completedDisbursement) {
      return await buildExistingDisbursementResponse({
        existingDisbursement: completedDisbursement,
        payoutRequestId: payload.payoutRequestId,
        alreadyCompleted: true
      })
    }
  }

  const initialized = await runWithOptionalTransaction(async (session) => {
    const payoutRequest = await PayoutRequest.findOne(
      { payoutRequestId: payload.payoutRequestId },
      undefined,
      { session }
    )

    if (!payoutRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Payout request not found'
      })
    }

    if (payoutRequest.status !== 'approved') {
      throw createError({
        statusCode: 409,
        statusMessage: `PAYOUT_INVALID_STATE_TRANSITION: Disburse attempted from invalid status (${payoutRequest.status})`
      })
    }

    const vendor = await Vendor.findOne({ vendorId: payoutRequest.vendorId }, undefined, { session })
    if (!vendor) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Vendor not found for payout request'
      })
    }

    const resolvedMethod = mapVendorToPayout({
      vendor,
      methodTypeOverride: payload.methodType
    }).type

    const approvedVendorId = vendor.approvedVendorId || payoutRequest.vendorId
    const disbursingAt = new Date()

    const transitionedToDisbursing = await PayoutRequest.findOneAndUpdate(
      { payoutRequestId: payload.payoutRequestId, status: 'approved' },
      {
        $set: {
          status: 'disbursing',
          disbursingAt
        }
      },
      { returnDocument: 'after', session }
    )

    if (!transitionedToDisbursing) {
      throw createError({
        statusCode: 409,
        statusMessage: 'PAYOUT_CONCURRENT_MODIFICATION: Conditional update failed due to concurrent mutation'
      })
    }

    const disbursementId = `disb_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`

    await PaymentDisbursement.create([{
      disbursementId,
      payoutRequestId: payload.payoutRequestId,
      idempotencyKey: payload.idempotencyKey,
      methodType: resolvedMethod,
      providerReferenceId: `pending_${payload.idempotencyKey}`,
      amount: payoutRequest.amount.toString(),
      currency: payoutRequest.currency,
      status: 'disbursing',
      disbursedAt: disbursingAt
    }], { session })

    await AuditEvent.create([{
      auditEventId: createAuditId(),
      actorId: adminIdentity.actorId,
      actorRole: adminIdentity.actorRole,
      action: 'disbursement_created',
      entityType: 'PaymentDisbursement',
      entityId: disbursementId,
      after: {
        payoutRequestId: payload.payoutRequestId,
        methodType: resolvedMethod,
        status: 'disbursing'
      },
      createdAt: disbursingAt
    }], { session })

    return {
      disbursementId,
      payoutRequestId: payoutRequest.payoutRequestId,
      vendorId: payoutRequest.vendorId,
      amount: payoutRequest.amount.toString(),
      currency: payoutRequest.currency,
      approvedVendorId,
      methodType: resolvedMethod,
      vendor: {
        vendorId: vendor.vendorId,
        displayName: vendor.displayName,
        legalName: vendor.legalName,
        preferredPayoutMethod: vendor.preferredPayoutMethod,
        paypalEmail: vendor.paypalEmail,
        venmoHandle: vendor.venmoHandle
      }
    }
  })

  try {
    const execution = await executePayout({
      disbursementId: initialized.disbursementId,
      idempotencyKey: payload.idempotencyKey,
      amount: initialized.amount,
      currency: initialized.currency,
      vendor: initialized.vendor,
      methodTypeOverride: payload.methodType
    })

    await PaymentDisbursement.updateOne(
      { disbursementId: initialized.disbursementId },
      {
        $set: {
          methodType: execution.methodType,
          providerReferenceId: execution.paypalBatchId,
          providerItemId: execution.providerItemId || execution.providerTransferId
        }
      }
    )
  } catch (error: unknown) {
    const failureReason = error instanceof Error
      ? error.message.slice(0, 500)
      : 'Provider disbursement initiation failed'

    await runWithOptionalTransaction(async (session) => {
      await PaymentDisbursement.updateOne(
        { disbursementId: initialized.disbursementId },
        {
          $set: {
            status: 'failed',
            failureReason,
            disbursedAt: new Date()
          }
        },
        { session }
      )

      await PayoutRequest.updateOne(
        { payoutRequestId: initialized.payoutRequestId, status: 'disbursing' },
        {
          $set: {
            status: 'failed',
            failedAt: new Date()
          }
        },
        { session }
      )

      await LedgerEntry.create([{
        entryId: `ledger_release_${initialized.payoutRequestId}_failed`,
        vendorId: initialized.vendorId,
        approvedVendorId: initialized.approvedVendorId,
        entryType: 'release',
        amount: initialized.amount,
        currency: initialized.currency,
        referenceType: 'PayoutRequest',
        referenceId: initialized.payoutRequestId,
        occurredAt: new Date()
      }], { session })

      await AuditEvent.create([{
        auditEventId: createAuditId(),
        actorId: adminIdentity.actorId,
        actorRole: adminIdentity.actorRole,
        action: 'disbursement_failed',
        entityType: 'PaymentDisbursement',
        entityId: initialized.disbursementId,
        after: {
          payoutRequestId: initialized.payoutRequestId,
          status: 'failed',
          failureReason
        },
        createdAt: new Date()
      }], { session })
    })

    await recomputeBalanceSnapshot(
      initialized.vendorId,
      initialized.approvedVendorId
    )

    throw createError({
      statusCode: 502,
      statusMessage: `DISBURSEMENT_PROVIDER_FAILURE: ${failureReason}`
    })
  }

  const finalDisbursement = await PaymentDisbursement.findOne({ disbursementId: initialized.disbursementId })
  const finalPayout = await PayoutRequest.findOne({ payoutRequestId: payload.payoutRequestId })

  if (!finalDisbursement || !finalPayout) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Disbursement could not be finalized'
    })
  }

  const balance = await recomputeBalanceSnapshot(
    initialized.vendorId,
    initialized.approvedVendorId
  )

  return {
    disbursement: {
      disbursementId: finalDisbursement.disbursementId,
      payoutRequestId: finalDisbursement.payoutRequestId,
      methodType: finalDisbursement.methodType,
      providerReferenceId: finalDisbursement.providerReferenceId,
      providerItemId: finalDisbursement.providerItemId,
      amount: finalDisbursement.amount.toString(),
      currency: finalDisbursement.currency,
      status: finalDisbursement.status,
      disbursedAt: finalDisbursement.disbursedAt,
      failureReason: finalDisbursement.failureReason,
      createdAt: finalDisbursement.createdAt,
      updatedAt: finalDisbursement.updatedAt
    },
    payoutRequest: {
      payoutRequestId: finalPayout.payoutRequestId,
      status: finalPayout.status,
      disbursingAt: finalPayout.disbursingAt,
      paidAt: finalPayout.paidAt,
      failedAt: finalPayout.failedAt,
      updatedAt: finalPayout.updatedAt
    },
    balance: {
      pendingAmount: balance.pendingAmount,
      availableAmount: balance.availableAmount,
      paidAmount: balance.paidAmount,
      asOf: balance.asOf
    }
  }
})
