import { z } from 'zod'
import { connectToDatabase } from '../../../../config/database'
import { AuditEvent } from '../../../../models/AuditEvent'
import { LedgerEntry } from '../../../../models/LedgerEntry'
import { PayoutRequest } from '../../../../models/PayoutRequest'
import { Vendor } from '../../../../models/Vendor'
import { recomputeBalanceSnapshot } from '../../../../utils/balance'
import { requireAdmin } from '../../../../utils/adminAuth'
import { runWithOptionalTransaction } from '../../../../utils/transactions'

const rejectPayoutRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500)
})

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const payoutId = getRouterParam(event, 'payoutId')
  if (!payoutId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Payout identifier is required'
    })
  }

  const body = await readBody(event)
  const parsedBody = rejectPayoutRequestSchema.safeParse(body)
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const result = await runWithOptionalTransaction(async (session) => {
    const payoutRequest = await PayoutRequest.findOne({ payoutRequestId: payoutId }, undefined, { session })

    if (!payoutRequest) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Payout request not found'
      })
    }

    if (payoutRequest.status !== 'requested') {
      throw createError({
        statusCode: 409,
        statusMessage: 'PAYOUT_INVALID_STATE_TRANSITION: Reject attempted from invalid status'
      })
    }

    const vendor = await Vendor.findOne({ vendorId: payoutRequest.vendorId }, undefined, { session })
    const approvedVendorId = vendor?.approvedVendorId || payoutRequest.vendorId

    const now = new Date()
    const updatedRequest = await PayoutRequest.findOneAndUpdate(
      { payoutRequestId: payoutId, status: 'requested' },
      {
        $set: {
          status: 'rejected',
          reviewedBy: adminIdentity.actorId,
          rejectionReason: parsedBody.data.reason,
          rejectedAt: now
        }
      },
      { returnDocument: 'after', session }
    )

    if (!updatedRequest) {
      throw createError({
        statusCode: 409,
        statusMessage: 'PAYOUT_CONCURRENT_MODIFICATION: Conditional update failed due to concurrent mutation'
      })
    }

    await LedgerEntry.create([{
      entryId: `ledger_release_${updatedRequest.payoutRequestId}`,
      vendorId: updatedRequest.vendorId,
      approvedVendorId,
      entryType: 'release',
      amount: updatedRequest.amount.toString(),
      currency: 'USD',
      referenceType: 'PayoutRequest',
      referenceId: updatedRequest.payoutRequestId,
      occurredAt: now
    }], { session })

    await recomputeBalanceSnapshot(updatedRequest.vendorId, approvedVendorId)

    await AuditEvent.create([{
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actorId: adminIdentity.actorId,
      actorRole: adminIdentity.actorRole,
      action: 'payout_rejected',
      entityType: 'PayoutRequest',
      entityId: updatedRequest.payoutRequestId,
      before: {
        status: payoutRequest.status
      },
      after: {
        status: updatedRequest.status,
        rejectedAt: updatedRequest.rejectedAt,
        reviewedBy: updatedRequest.reviewedBy,
        rejectionReason: updatedRequest.rejectionReason
      },
      createdAt: now
    }], { session })

    return {
      payoutRequest: updatedRequest,
      balance: await recomputeBalanceSnapshot(updatedRequest.vendorId, approvedVendorId)
    }
  })

  return {
    payoutRequest: {
      payoutRequestId: result.payoutRequest.payoutRequestId,
      vendorId: result.payoutRequest.vendorId,
      amount: result.payoutRequest.amount.toString(),
      currency: result.payoutRequest.currency,
      status: result.payoutRequest.status,
      rejectedAt: result.payoutRequest.rejectedAt,
      reviewedBy: result.payoutRequest.reviewedBy,
      rejectionReason: result.payoutRequest.rejectionReason,
      updatedAt: result.payoutRequest.updatedAt
    },
    balance: {
      pendingAmount: result.balance.pendingAmount,
      availableAmount: result.balance.availableAmount,
      paidAmount: result.balance.paidAmount,
      asOf: result.balance.asOf
    }
  }
})
