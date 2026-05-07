import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { LedgerEntry } from '../../models/LedgerEntry'
import { PayoutRequest } from '../../models/PayoutRequest'
import { recomputeBalanceSnapshot } from '../../utils/balance'
import { createPayoutRequestId, formatUsdAmount, parsePositivePayoutAmount } from '../../utils/payouts'
import { checkRateLimit } from '../../utils/rateLimit'
import { requireVendorId } from '../../utils/vendorContext'

const createPayoutRequestSchema = z.object({
  amount: z.union([z.string(), z.number()])
})

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorId = requireVendorId(event)
  const rateLimitResult = checkRateLimit(`payout:${vendorId}`, {
    max: 10,
    windowMs: 60 * 60 * 1000
  })

  if (!rateLimitResult.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'AUTH_RATE_LIMITED: Payout request rate limit exceeded'
    })
  }

  const body = await readBody(event)
  const parsedBody = createPayoutRequestSchema.safeParse(body)

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PAYOUT_INVALID_AMOUNT: Requested amount must be greater than zero'
    })
  }

  const amount = parsePositivePayoutAmount(parsedBody.data.amount)
  const currentBalance = await recomputeBalanceSnapshot(vendorId)

  if (amount.gt(currentBalance.availableAmount)) {
    throw createError({
      statusCode: 409,
      statusMessage: 'PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE: Requested amount exceeds available balance'
    })
  }

  const now = new Date()
  const payoutRequestId = createPayoutRequestId()
  const formattedAmount = formatUsdAmount(amount)

  const payoutRequest = await PayoutRequest.create({
    payoutRequestId,
    vendorId,
    amount: formattedAmount,
    currency: 'USD',
    status: 'requested',
    requestedAt: now
  })

  await LedgerEntry.create({
    entryId: `ledger_${payoutRequestId}`,
    vendorId,
    entryType: 'reservation',
    amount: formattedAmount,
    currency: 'USD',
    referenceType: 'PayoutRequest',
    referenceId: payoutRequestId,
    occurredAt: now
  })

  const updatedBalance = await recomputeBalanceSnapshot(vendorId)

  return {
    payoutRequest: {
      payoutRequestId: payoutRequest.payoutRequestId,
      amount: payoutRequest.amount.toString(),
      currency: payoutRequest.currency,
      status: payoutRequest.status,
      requestedAt: payoutRequest.requestedAt,
      createdAt: payoutRequest.createdAt,
      updatedAt: payoutRequest.updatedAt
    },
    balance: {
      pendingAmount: updatedBalance.pendingAmount,
      availableAmount: updatedBalance.availableAmount,
      paidAmount: updatedBalance.paidAmount,
      asOf: updatedBalance.asOf
    }
  }
})
