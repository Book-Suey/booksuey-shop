import { connectToDatabase } from '../../../config/database'
import { PayoutRequest } from '../../../models/PayoutRequest'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const payoutId = getRouterParam(event, 'payoutId')
  if (!payoutId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Payout identifier is required'
    })
  }

  const payoutRequest = await PayoutRequest.findOne({ payoutRequestId: payoutId })
  if (!payoutRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Payout request not found'
    })
  }

  const vendor = await Vendor.findOne({ vendorId: payoutRequest.vendorId })

  return {
    payoutRequest: {
      payoutRequestId: payoutRequest.payoutRequestId,
      vendorId: payoutRequest.vendorId,
      vendorName: vendor?.displayName || vendor?.legalName || 'Unknown Vendor',
      amount: payoutRequest.amount.toString(),
      currency: payoutRequest.currency,
      status: payoutRequest.status,
      requestedAt: payoutRequest.requestedAt,
      approvedAt: payoutRequest.approvedAt,
      rejectedAt: payoutRequest.rejectedAt,
      rejectionReason: payoutRequest.rejectionReason,
      reviewedBy: payoutRequest.reviewedBy,
      reviewNote: payoutRequest.reviewNote,
      disbursingAt: payoutRequest.disbursingAt,
      paidAt: payoutRequest.paidAt,
      failedAt: payoutRequest.failedAt,
      createdAt: payoutRequest.createdAt,
      updatedAt: payoutRequest.updatedAt
    }
  }
})
