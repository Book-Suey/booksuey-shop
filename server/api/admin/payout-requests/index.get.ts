import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { PayoutRequest } from '../../../models/PayoutRequest'
import { requireAdmin } from '../../../utils/adminAuth'
import { PAYOUT_REQUEST_STATUSES } from '../../../utils/payouts'

const listPayoutRequestsQuerySchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional()
})

function normalizeStatuses(status: string | string[] | undefined): string[] {
  if (!status) {
    return ['requested', 'approved', 'disbursing']
  }

  const rawValues = Array.isArray(status) ? status : status.split(',')
  const values = rawValues.map(value => value.trim()).filter(Boolean)

  const invalidValues = values.filter(value => !PAYOUT_REQUEST_STATUSES.includes(value as typeof PAYOUT_REQUEST_STATUSES[number]))

  if (invalidValues.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid payout status filter: ${invalidValues.join(', ')}`
    })
  }

  return values
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const query = getQuery(event)
  const parsedQuery = listPayoutRequestsQuerySchema.safeParse(query)

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters'
    })
  }

  const statuses = normalizeStatuses(parsedQuery.data.status)
  const filters: {
    status: { $in: string[] }
    requestedAt?: { $gte?: Date, $lte?: Date }
  } = {
    status: { $in: statuses }
  }

  if (parsedQuery.data.dateFrom || parsedQuery.data.dateTo) {
    filters.requestedAt = {}

    if (parsedQuery.data.dateFrom) {
      filters.requestedAt.$gte = new Date(parsedQuery.data.dateFrom)
    }

    if (parsedQuery.data.dateTo) {
      filters.requestedAt.$lte = new Date(parsedQuery.data.dateTo)
    }
  }

  const payoutRequests = await PayoutRequest.find(filters).sort({ requestedAt: -1, _id: -1 })

  return {
    payoutRequests: payoutRequests.map((payoutRequest: {
      payoutRequestId: string
      vendorId: string
      amount: { toString(): string }
      currency: string
      status: string
      requestedAt: Date
      approvedAt?: Date
      rejectedAt?: Date
      disbursingAt?: Date
      paidAt?: Date
      failedAt?: Date
      createdAt: Date
      updatedAt: Date
    }) => ({
      payoutRequestId: payoutRequest.payoutRequestId,
      vendorId: payoutRequest.vendorId,
      amount: payoutRequest.amount.toString(),
      currency: payoutRequest.currency,
      status: payoutRequest.status,
      requiresAction: payoutRequest.status === 'requested',
      requestedAt: payoutRequest.requestedAt,
      approvedAt: payoutRequest.approvedAt,
      rejectedAt: payoutRequest.rejectedAt,
      disbursingAt: payoutRequest.disbursingAt,
      paidAt: payoutRequest.paidAt,
      failedAt: payoutRequest.failedAt,
      createdAt: payoutRequest.createdAt,
      updatedAt: payoutRequest.updatedAt
    }))
  }
})
