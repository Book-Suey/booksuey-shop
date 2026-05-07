import Decimal from 'decimal.js'
import { z } from 'zod'
import { connectToDatabase } from '../../../../config/database'
import { AuditEvent } from '../../../../models/AuditEvent'
import { PayoutRequest } from '../../../../models/PayoutRequest'
import { recomputeBalanceSnapshot } from '../../../../utils/balance'
import { requireAdmin } from '../../../../utils/adminAuth'
import { runWithOptionalTransaction } from '../../../../utils/transactions'

const approvePayoutRequestSchema = z.object({
  reviewNote: z.string().trim().max(500).optional()
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
  const parsedBody = approvePayoutRequestSchema.safeParse(body ?? {})
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
        statusMessage: 'PAYOUT_INVALID_STATE_TRANSITION: Approve attempted from invalid status'
      })
    }

    const balance = await recomputeBalanceSnapshot(payoutRequest.vendorId)
    if (new Decimal(balance.pendingAmount).lt(payoutRequest.amount.toString())) {
      throw createError({
        statusCode: 409,
        statusMessage: 'PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE: Approval attempted without enough reserved funds'
      })
    }

    const now = new Date()
    const updatedRequest = await PayoutRequest.findOneAndUpdate(
      { payoutRequestId: payoutId, status: 'requested' },
      {
        $set: {
          status: 'approved',
          reviewedBy: adminIdentity.actorId,
          reviewNote: parsedBody.data.reviewNote,
          approvedAt: now
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

    await AuditEvent.create([{
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actorId: adminIdentity.actorId,
      actorRole: adminIdentity.actorRole,
      action: 'payout_approved',
      entityType: 'PayoutRequest',
      entityId: updatedRequest.payoutRequestId,
      before: {
        status: payoutRequest.status
      },
      after: {
        status: updatedRequest.status,
        approvedAt: updatedRequest.approvedAt,
        reviewedBy: updatedRequest.reviewedBy,
        reviewNote: updatedRequest.reviewNote
      },
      createdAt: now
    }], { session })

    return updatedRequest
  })

  return {
    payoutRequest: {
      payoutRequestId: result.payoutRequestId,
      vendorId: result.vendorId,
      amount: result.amount.toString(),
      currency: result.currency,
      status: result.status,
      approvedAt: result.approvedAt,
      reviewedBy: result.reviewedBy,
      reviewNote: result.reviewNote,
      updatedAt: result.updatedAt
    }
  }
})
