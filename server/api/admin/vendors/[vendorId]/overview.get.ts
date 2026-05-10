import { connectToDatabase } from '../../../../config/database'
import { Vendor } from '../../../../models/Vendor'
import { SaleRecord } from '../../../../models/SaleRecord'
import { LedgerEntry } from '../../../../models/LedgerEntry'
import { PayoutRequest } from '../../../../models/PayoutRequest'
import { requireAdmin } from '../../../../utils/adminAuth'
import { recomputeBalanceSnapshot, getLedgerEntryBalanceImpact } from '../../../../utils/balance'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const vendorId = getRouterParam(event, 'vendorId')
  if (!vendorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vendor identifier is required'
    })
  }

  const vendor = await Vendor.findOne({
    $or: [
      { vendorId },
      { approvedVendorId: vendorId }
    ]
  }).select('-passwordHash -passwordResetToken -passwordResetExpires')

  if (!vendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Vendor not found'
    })
  }

  const snapshot = await recomputeBalanceSnapshot(
    vendor.vendorId,
    vendor.approvedVendorId || undefined
  )

  const vendorScopeQuery = vendor.approvedVendorId
    ? {
        $or: [
          { vendorId: vendor.vendorId },
          { approvedVendorId: vendor.approvedVendorId }
        ]
      }
    : { vendorId: vendor.vendorId }

  const [sales, ledgerEntries, payoutRequests] = await Promise.all([
    SaleRecord.find(vendorScopeQuery)
      .sort({ soldAt: -1, _id: -1 })
      .limit(8),
    LedgerEntry.find(vendorScopeQuery)
      .sort({ occurredAt: -1, _id: -1 })
      .limit(8),
    PayoutRequest.find({ vendorId: vendor.vendorId })
      .sort({ requestedAt: -1, _id: -1 })
      .limit(8)
  ])

  return {
    vendor: {
      vendorId: vendor.vendorId,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      email: vendor.email,
      phone: vendor.phone,
      status: vendor.status,
      approvedVendorId: vendor.approvedVendorId
    },
    balance: {
      pendingAmount: snapshot.pendingAmount,
      availableAmount: snapshot.availableAmount,
      paidAmount: snapshot.paidAmount,
      asOf: snapshot.asOf
    },
    sales: sales.map((sale: {
      _id: unknown
      soldAt: Date
      title: string
      grossAmount: { toString: () => string }
      commissionAmount: { toString: () => string }
      currency: string
    }) => ({
      saleRecordId: String(sale._id),
      soldAt: sale.soldAt,
      title: sale.title,
      grossAmount: sale.grossAmount.toString(),
      commissionAmount: sale.commissionAmount.toString(),
      currency: sale.currency
    })),
    ledgerEntries: ledgerEntries.map((entry: {
      entryId: string
      entryType: string
      amount: { toString: () => string }
      currency: string
      occurredAt: Date
      referenceType: string
      referenceId: string
    }) => {
      const amount = entry.amount.toString()

      return {
        entryId: entry.entryId,
        entryType: entry.entryType,
        amount,
        balanceImpact: getLedgerEntryBalanceImpact(
          entry.entryType as 'sale' | 'reservation' | 'release' | 'paid',
          amount
        ),
        currency: entry.currency,
        occurredAt: entry.occurredAt,
        reference: {
          referenceType: entry.referenceType,
          referenceId: entry.referenceId
        }
      }
    }),
    payoutRequests: payoutRequests.map((request: {
      payoutRequestId: string
      amount: { toString: () => string }
      currency: string
      status: string
      requestedAt: Date
    }) => ({
      payoutRequestId: request.payoutRequestId,
      amount: request.amount.toString(),
      currency: request.currency,
      status: request.status,
      requestedAt: request.requestedAt
    }))
  }
})
