import { connectToDatabase } from '../../config/database'
import { PayoutRequest } from '../../models/PayoutRequest'
import { requireVendorId } from '../../utils/vendorContext'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorId = requireVendorId(event)
  const payoutRequests = await PayoutRequest.find({ vendorId }).sort({ requestedAt: -1, _id: -1 })

  return {
    payoutRequests: payoutRequests.map((request: {
      payoutRequestId: string
      amount: { toString(): string }
      currency: string
      status: string
      reviewNote?: string
      rejectionReason?: string
      requestedAt: Date
      approvedAt?: Date
      rejectedAt?: Date
      disbursingAt?: Date
      paidAt?: Date
      failedAt?: Date
      createdAt: Date
      updatedAt: Date
    }) => ({
      payoutRequestId: request.payoutRequestId,
      amount: request.amount.toString(),
      currency: request.currency,
      status: request.status,
      reviewNote: request.reviewNote,
      rejectionReason: request.rejectionReason,
      requestedAt: request.requestedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      disbursingAt: request.disbursingAt,
      paidAt: request.paidAt,
      failedAt: request.failedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    }))
  }
})
