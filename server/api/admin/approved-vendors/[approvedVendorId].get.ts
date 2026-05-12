import Decimal from 'decimal.js'
import { connectToDatabase } from '../../../config/database'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { SaleRecord } from '../../../models/SaleRecord'
import { SalesImportBatch } from '../../../models/SalesImportBatch'
import { Vendor } from '../../../models/Vendor'
import { recomputeBalanceSnapshot } from '../../../utils/balance'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const approvedVendorId = getRouterParam(event, 'approvedVendorId')
  if (!approvedVendorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Approved vendor identifier is required'
    })
  }

  const approvedVendor = await ApprovedVendor.findOne({ basilId: approvedVendorId }).lean()
  if (!approvedVendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Approved vendor not found'
    })
  }

  const linkedVendor = await Vendor.findOne({ approvedVendorId })
    .select('-passwordHash -passwordResetToken -passwordResetExpires')
    .lean()

  const sales = await SaleRecord.find({ approvedVendorId })
    .sort({ soldAt: -1, _id: -1 })
    .limit(25)
    .lean()

  const salesSummary = sales.reduce((summary: {
    count: number
    totalGross: Decimal
    totalCommission: Decimal
    latestSoldAt: Date | null
  }, sale: {
    grossAmount: { toString: () => string }
    commissionAmount: { toString: () => string }
    soldAt: Date
  }) => {
    summary.count += 1
    summary.totalGross = summary.totalGross.plus(sale.grossAmount.toString())
    summary.totalCommission = summary.totalCommission.plus(sale.commissionAmount.toString())

    if (!summary.latestSoldAt || sale.soldAt > summary.latestSoldAt) {
      summary.latestSoldAt = sale.soldAt
    }

    return summary
  }, {
    count: 0,
    totalGross: new Decimal(0),
    totalCommission: new Decimal(0),
    latestSoldAt: null as Date | null
  })

  const linkedBalance = linkedVendor
    ? await recomputeBalanceSnapshot(linkedVendor.vendorId, linkedVendor.approvedVendorId || undefined)
    : null

  // Get batch details for each sale
  const batchIds = [...new Set(sales.map((s: { sourceBatchId: string }) => s.sourceBatchId))]
  const batches = await SalesImportBatch.find({
    batchId: { $in: batchIds }
  }).select('batchId sourcePeriod').lean()

  const batchMap = new Map(
    batches.map((b: { batchId: string, sourcePeriod: string }) => [
      b.batchId,
      b.sourcePeriod
    ])
  )

  return {
    approvedVendor,
    linkedVendor: linkedVendor
      ? {
          vendorId: linkedVendor.vendorId,
          legalName: linkedVendor.legalName,
          displayName: linkedVendor.displayName,
          email: linkedVendor.email,
          phone: linkedVendor.phone,
          status: linkedVendor.status,
          preferredPayoutMethod: linkedVendor.preferredPayoutMethod,
          approvedVendorId: linkedVendor.approvedVendorId,
          createdAt: linkedVendor.createdAt,
          updatedAt: linkedVendor.updatedAt,
          lastLoginAt: linkedVendor.lastLoginAt
        }
      : null,
    linkedBalance,
    importedSales: sales.map((sale: {
      _id: unknown
      vendorId?: string
      soldAt: Date
      title: string
      grossAmount: { toString: () => string }
      commissionAmount: { toString: () => string }
      sourceBatchId: string
      saleOrderId: string
      currency: string
    }) => ({
      saleRecordId: String(sale._id),
      vendorId: sale.vendorId || null,
      soldAt: sale.soldAt,
      title: sale.title,
      grossAmount: sale.grossAmount.toString(),
      commissionAmount: sale.commissionAmount.toString(),
      period: batchMap.get(sale.sourceBatchId) || sale.sourceBatchId,
      saleOrderId: sale.saleOrderId,
      currency: sale.currency
    })),
    salesSummary: {
      count: salesSummary.count,
      totalGross: salesSummary.totalGross.toFixed(2),
      totalCommission: salesSummary.totalCommission.toFixed(2),
      latestSoldAt: salesSummary.latestSoldAt
    }
  }
})
