import mongoose from 'mongoose'
import Decimal from 'decimal.js'
import { connectToDatabase } from '../../config/database'
import { LedgerEntry } from '../../models/LedgerEntry'
import { PaymentDisbursement } from '../../models/PaymentDisbursement'
import { SaleRecord } from '../../models/SaleRecord'
import {
  applyLedgerEntryToBalance,
  getLedgerEntryBalanceImpact
} from '../../utils/balance'
import { requireVendorScope } from '../../utils/vendorContext'

type SaleLedgerReference = {
  soldAt: Date
  title: string
}

function mapVendorFriendlyReversalReason(reason: string | undefined): string {
  const normalized = (reason || '').trim().toLowerCase()

  if (!normalized) {
    return 'This payout was reversed because the payment provider could not complete the transfer.'
  }

  if (
    normalized.includes('receiver is invalid')
    || normalized.includes('invalid recipient')
    || normalized.includes('does not match with type')
    || normalized.includes('user_handle invalid')
    || normalized.includes('venmo handle invalid')
    || normalized.includes('paypal email invalid')
  ) {
    return 'This payout was reversed because your payout account details were invalid. Please update your payout settings and try again.'
  }

  if (
    normalized.includes('blocked')
    || normalized.includes('restricted')
    || normalized.includes('limited')
    || normalized.includes('compliance')
    || normalized.includes('risk')
    || normalized.includes('denied')
  ) {
    return 'This payout was reversed because your payout account is currently restricted by the payment provider.'
  }

  if (
    normalized.includes('processor declined')
    || normalized.includes('declined')
    || normalized.includes('refused')
    || normalized.includes('rejected by processor')
  ) {
    return 'This payout was reversed because the payment provider declined the transfer.'
  }

  if (
    normalized.includes('timeout')
    || normalized.includes('network')
    || normalized.includes('unavailable')
    || normalized.includes('service unavailable')
    || normalized.includes('internal server error')
    || normalized.includes('gateway')
    || normalized.includes('provider timeout')
  ) {
    return 'This payout was reversed due to a temporary payment provider issue. Please try again later.'
  }

  if (
    normalized.includes('reversed')
    || normalized.includes('returned')
    || normalized.includes('refunded')
  ) {
    return 'This payout was reversed by the payment provider after it was initiated.'
  }

  if (
    normalized.includes('unprocessable_entity')
    || normalized.includes('validation error')
    || normalized.includes('invalid request')
  ) {
    return 'This payout was reversed because the provider could not validate the payout request details.'
  }

  return 'This payout was reversed because the payment provider could not complete the transfer.'
}

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorScope = requireVendorScope(event)
  const ledgerScopeQuery = vendorScope.approvedVendorId
    ? {
        $or: [
          { vendorId: vendorScope.vendorId },
          { approvedVendorId: vendorScope.approvedVendorId }
        ]
      }
    : { vendorId: vendorScope.vendorId }
  const entries = await LedgerEntry.find(ledgerScopeQuery).sort({ occurredAt: 1, _id: 1 })
  const saleRecordIds = entries
    .filter((entry: { referenceType: string, referenceId: string }) => entry.referenceType === 'SaleRecord' && mongoose.Types.ObjectId.isValid(entry.referenceId))
    .map((entry: { referenceId: string }) => new mongoose.Types.ObjectId(entry.referenceId))

  const saleRecords = saleRecordIds.length > 0
    ? await SaleRecord.find({ _id: { $in: saleRecordIds } })
    : []

  const saleRecordById = new Map<string, SaleLedgerReference>(saleRecords.map((sale: {
    _id: mongoose.Types.ObjectId
    soldAt: Date
    title: string
  }) => [String(sale._id), sale] as const))

  const payoutRequestIds = Array.from(new Set(entries
    .filter((entry: { referenceType: string }) => entry.referenceType === 'PayoutRequest')
    .map((entry: { referenceId: string }) => entry.referenceId)))

  const failedDisbursements = payoutRequestIds.length > 0
    ? await PaymentDisbursement.find({
        payoutRequestId: { $in: payoutRequestIds },
        status: 'failed'
      })
        .sort({ updatedAt: -1 })
        .select({ payoutRequestId: 1, failureReason: 1 })
    : []

  const failureReasonByPayoutRequestId = new Map<string, string>()
  for (const disbursement of failedDisbursements as Array<{
    payoutRequestId: string
    failureReason?: string
  }>) {
    if (!failureReasonByPayoutRequestId.has(disbursement.payoutRequestId) && disbursement.failureReason) {
      failureReasonByPayoutRequestId.set(disbursement.payoutRequestId, disbursement.failureReason)
    }
  }

  const runningBalance = {
    pendingAmount: new Decimal(0),
    availableAmount: new Decimal(0),
    paidAmount: new Decimal(0)
  }

  const ledgerEntries = entries.map((entry: {
    entryId: string
    entryType: 'sale' | 'reservation' | 'release' | 'paid' | 'opening_balance'
    amount: { toString(): string }
    currency: string
    referenceType: string
    referenceId: string
    occurredAt: Date
    description?: string
  }) => {
    const amount = entry.amount.toString()
    applyLedgerEntryToBalance(runningBalance, {
      entryType: entry.entryType,
      amount
    })

    const saleRecord = saleRecordById.get(entry.referenceId)

    const reversalReason = entry.entryType === 'release'
      ? mapVendorFriendlyReversalReason(failureReasonByPayoutRequestId.get(entry.referenceId))
      : undefined

    return {
      entryId: entry.entryId,
      entryType: entry.entryType,
      amount,
      balanceImpact: getLedgerEntryBalanceImpact(entry.entryType, amount),
      balanceAfter: runningBalance.availableAmount.toFixed(2),
      currency: entry.currency,
      occurredAt: entry.occurredAt,
      description: reversalReason ?? entry.description,
      ...(saleRecord
        ? {
            sale: {
              soldAt: saleRecord.soldAt,
              title: saleRecord.title
            }
          }
        : {})
    }
  })

  return {
    ledgerEntries: ledgerEntries.reverse()
  }
})
