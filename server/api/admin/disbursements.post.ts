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
import { runWithOptionalTransaction } from '../../utils/transactions'

const createDisbursementSchema = z.object({
  payoutRequestId: z.string().trim().min(1),
  methodType: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(200),
  providerReferenceId: z.string().trim().min(1).max(200),
  outcome: z.enum(['paid', 'failed']).optional(),
  failureReason: z.string().trim().min(1).max(500).optional()
})

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
  if (payload.methodType !== 'paypal' && payload.methodType !== 'venmo') {
    throw createError({
      statusCode: 400,
      statusMessage: 'PAYOUT_UNSUPPORTED_METHOD: methodType is not paypal or venmo'
    })
  }

  const outcome = payload.outcome ?? 'paid'
  if (outcome === 'failed' && !payload.failureReason) {
    throw createError({
      statusCode: 400,
      statusMessage: 'DISBURSEMENT_PROVIDER_FAILURE: Failure reason is required when outcome is failed'
    })
  }

  const existingDisbursement = await PaymentDisbursement.findOne({
    payoutRequestId: payload.payoutRequestId,
    idempotencyKey: payload.idempotencyKey
  })

  if (existingDisbursement) {
    return {
      idempotentReplay: true,
      disbursement: {
        disbursementId: existingDisbursement.disbursementId,
        payoutRequestId: existingDisbursement.payoutRequestId,
        methodType: existingDisbursement.methodType,
        providerReferenceId: existingDisbursement.providerReferenceId,
        amount: existingDisbursement.amount.toString(),
        currency: existingDisbursement.currency,
        status: existingDisbursement.status,
        disbursedAt: existingDisbursement.disbursedAt,
        failureReason: existingDisbursement.failureReason,
        createdAt: existingDisbursement.createdAt,
        updatedAt: existingDisbursement.updatedAt
      }
    }
  }

  const result = await runWithOptionalTransaction(async (session) => {
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
        statusMessage: 'PAYOUT_INVALID_STATE_TRANSITION: Disburse attempted from invalid status'
      })
    }

    const vendor = await Vendor.findOne({ vendorId: payoutRequest.vendorId }, undefined, { session })
    const approvedVendorId = vendor?.approvedVendorId || payoutRequest.vendorId

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
      methodType: payload.methodType,
      providerReferenceId: payload.providerReferenceId,
      amount: payoutRequest.amount.toString(),
      currency: payoutRequest.currency,
      status: 'disbursing',
      disbursedAt: disbursingAt
    }], { session })

    await AuditEvent.create([{
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actorId: adminIdentity.actorId,
      actorRole: adminIdentity.actorRole,
      action: 'disbursement_created',
      entityType: 'PaymentDisbursement',
      entityId: disbursementId,
      after: {
        payoutRequestId: payload.payoutRequestId,
        methodType: payload.methodType,
        status: 'disbursing'
      },
      createdAt: disbursingAt
    }], { session })

    const settledAt = new Date()

    if (outcome === 'paid') {
      await LedgerEntry.create([{
        entryId: `ledger_paid_${payload.payoutRequestId}`,
        vendorId: payoutRequest.vendorId,
        approvedVendorId,
        entryType: 'paid',
        amount: payoutRequest.amount.toString(),
        currency: 'USD',
        referenceType: 'PayoutRequest',
        referenceId: payload.payoutRequestId,
        occurredAt: settledAt
      }], { session })

      await PayoutRequest.updateOne(
        { payoutRequestId: payload.payoutRequestId, status: 'disbursing' },
        {
          $set: {
            status: 'paid',
            paidAt: settledAt
          }
        },
        { session }
      )

      await PaymentDisbursement.updateOne(
        { disbursementId },
        {
          $set: {
            status: 'paid',
            disbursedAt: settledAt
          }
        },
        { session }
      )

      await AuditEvent.create([{
        auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        actorId: adminIdentity.actorId,
        actorRole: adminIdentity.actorRole,
        action: 'disbursement_completed',
        entityType: 'PaymentDisbursement',
        entityId: disbursementId,
        after: {
          payoutRequestId: payload.payoutRequestId,
          status: 'paid',
          disbursedAt: settledAt
        },
        createdAt: settledAt
      }], { session })
    } else {
      await LedgerEntry.create([{
        entryId: `ledger_release_${payload.payoutRequestId}_failed`,
        vendorId: payoutRequest.vendorId,
        approvedVendorId,
        entryType: 'release',
        amount: payoutRequest.amount.toString(),
        currency: 'USD',
        referenceType: 'PayoutRequest',
        referenceId: payload.payoutRequestId,
        occurredAt: settledAt
      }], { session })

      await PayoutRequest.updateOne(
        { payoutRequestId: payload.payoutRequestId, status: 'disbursing' },
        {
          $set: {
            status: 'failed',
            failedAt: settledAt
          }
        },
        { session }
      )

      await PaymentDisbursement.updateOne(
        { disbursementId },
        {
          $set: {
            status: 'failed',
            disbursedAt: settledAt,
            failureReason: payload.failureReason
          }
        },
        { session }
      )

      await AuditEvent.create([{
        auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        actorId: adminIdentity.actorId,
        actorRole: adminIdentity.actorRole,
        action: 'disbursement_failed',
        entityType: 'PaymentDisbursement',
        entityId: disbursementId,
        after: {
          payoutRequestId: payload.payoutRequestId,
          status: 'failed',
          disbursedAt: settledAt,
          failureReason: payload.failureReason
        },
        createdAt: settledAt
      }], { session })
    }

    const finalDisbursement = await PaymentDisbursement.findOne({ disbursementId }, undefined, { session })
    const finalPayout = await PayoutRequest.findOne({ payoutRequestId: payload.payoutRequestId }, undefined, { session })

    if (!finalDisbursement || !finalPayout) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Disbursement could not be finalized'
      })
    }

    return {
      disbursement: finalDisbursement,
      payoutRequest: finalPayout,
      approvedVendorId
    }
  })

  const balance = await recomputeBalanceSnapshot(
    result.payoutRequest.vendorId,
    result.approvedVendorId
  )

  return {
    disbursement: {
      disbursementId: result.disbursement.disbursementId,
      payoutRequestId: result.disbursement.payoutRequestId,
      methodType: result.disbursement.methodType,
      providerReferenceId: result.disbursement.providerReferenceId,
      amount: result.disbursement.amount.toString(),
      currency: result.disbursement.currency,
      status: result.disbursement.status,
      disbursedAt: result.disbursement.disbursedAt,
      failureReason: result.disbursement.failureReason,
      createdAt: result.disbursement.createdAt,
      updatedAt: result.disbursement.updatedAt
    },
    payoutRequest: {
      payoutRequestId: result.payoutRequest.payoutRequestId,
      status: result.payoutRequest.status,
      disbursingAt: result.payoutRequest.disbursingAt,
      paidAt: result.payoutRequest.paidAt,
      failedAt: result.payoutRequest.failedAt,
      updatedAt: result.payoutRequest.updatedAt
    },
    balance: {
      pendingAmount: balance.pendingAmount,
      availableAmount: balance.availableAmount,
      paidAmount: balance.paidAmount,
      asOf: balance.asOf
    }
  }
})
