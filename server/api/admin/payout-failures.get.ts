import Decimal from 'decimal.js'
import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { BalanceSnapshot } from '../../models/BalanceSnapshot'
import { LedgerEntry } from '../../models/LedgerEntry'
import { PaymentDisbursement } from '../../models/PaymentDisbursement'
import { PayoutRequest } from '../../models/PayoutRequest'
import { requireAdmin } from '../../utils/adminAuth'

const payoutFailuresQuerySchema = z.object({
  vendorId: z.string().trim().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const query = getQuery(event)
  const parsedQuery = payoutFailuresQuerySchema.safeParse(query)

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters'
    })
  }

  const filters: {
    status: 'failed'
    vendorId?: string
    failedAt?: { $gte?: Date, $lte?: Date }
  } = {
    status: 'failed'
  }

  if (parsedQuery.data.vendorId) {
    filters.vendorId = parsedQuery.data.vendorId
  }

  if (parsedQuery.data.dateFrom || parsedQuery.data.dateTo) {
    filters.failedAt = {}

    if (parsedQuery.data.dateFrom) {
      filters.failedAt.$gte = new Date(parsedQuery.data.dateFrom)
    }

    if (parsedQuery.data.dateTo) {
      filters.failedAt.$lte = new Date(parsedQuery.data.dateTo)
    }
  }

  const limit = parsedQuery.data.limit ?? 100
  const failedPayouts = await PayoutRequest.find(filters).sort({ failedAt: -1, _id: -1 }).limit(limit)
  const payoutRequestIds = failedPayouts.map((request: { payoutRequestId: string }) => request.payoutRequestId)
  const vendorIds = Array.from(new Set(failedPayouts.map((request: { vendorId: string }) => request.vendorId)))

  const [disbursements, releaseEntries, balanceSnapshots] = await Promise.all([
    PaymentDisbursement.find({ payoutRequestId: { $in: payoutRequestIds } }).sort({ updatedAt: -1, _id: -1 }),
    LedgerEntry.find({
      referenceType: 'PayoutRequest',
      referenceId: { $in: payoutRequestIds },
      entryType: 'release'
    }).sort({ occurredAt: -1, _id: -1 }),
    BalanceSnapshot.find({ vendorId: { $in: vendorIds } })
  ])

  const disbursementByPayoutId = new Map<string, {
    disbursementId: string
    methodType: 'paypal' | 'venmo'
    providerReferenceId: string
    status: 'disbursing' | 'paid' | 'failed'
    disbursedAt: Date
    failureReason?: string
  }>()

  for (const disbursement of disbursements) {
    if (!disbursementByPayoutId.has(disbursement.payoutRequestId)) {
      disbursementByPayoutId.set(disbursement.payoutRequestId, {
        disbursementId: disbursement.disbursementId,
        methodType: disbursement.methodType,
        providerReferenceId: disbursement.providerReferenceId,
        status: disbursement.status,
        disbursedAt: disbursement.disbursedAt,
        failureReason: disbursement.failureReason
      })
    }
  }

  const releaseAmountByPayoutId = new Map<string, string>()
  for (const entry of releaseEntries) {
    const current = new Decimal(releaseAmountByPayoutId.get(entry.referenceId) ?? '0')
    releaseAmountByPayoutId.set(entry.referenceId, current.plus(entry.amount.toString()).toFixed(2))
  }

  const balanceByVendorId = new Map<string, {
    pendingAmount: string
    availableAmount: string
    paidAmount: string
    asOf: Date
  }>()

  for (const balance of balanceSnapshots) {
    balanceByVendorId.set(balance.vendorId, {
      pendingAmount: balance.pendingAmount.toString(),
      availableAmount: balance.availableAmount.toString(),
      paidAmount: balance.paidAmount.toString(),
      asOf: balance.asOf
    })
  }

  return {
    payoutFailures: failedPayouts.map((payoutRequest: {
      payoutRequestId: string
      vendorId: string
      amount: { toString(): string }
      currency: 'USD'
      failedAt?: Date
      status: 'failed'
    }) => {
      const expectedReleaseAmount = payoutRequest.amount.toString()
      const releasedAmount = releaseAmountByPayoutId.get(payoutRequest.payoutRequestId) ?? '0.00'
      const restored = new Decimal(releasedAmount).gte(expectedReleaseAmount)

      return {
        payoutRequestId: payoutRequest.payoutRequestId,
        vendorId: payoutRequest.vendorId,
        amount: expectedReleaseAmount,
        currency: payoutRequest.currency,
        status: payoutRequest.status,
        failedAt: payoutRequest.failedAt,
        disbursement: disbursementByPayoutId.get(payoutRequest.payoutRequestId),
        reconciliation: {
          expectedReleaseAmount,
          releasedAmount,
          restored
        },
        balanceSnapshot: balanceByVendorId.get(payoutRequest.vendorId)
      }
    })
  }
})
