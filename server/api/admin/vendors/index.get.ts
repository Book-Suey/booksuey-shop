import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { BalanceSnapshot } from '../../../models/BalanceSnapshot'
import { SaleRecord } from '../../../models/SaleRecord'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'

const vendorsQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const query = getQuery(event)
  const parsed = vendorsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters'
    })
  }

  const filter = parsed.data.status
    ? { status: parsed.data.status }
    : {}

  const vendors = await Vendor.find(filter)
    .select('-passwordHash -passwordResetToken -passwordResetExpires')
    .sort({ createdAt: -1 })

  const vendorIds = vendors.map((vendor: { vendorId: string }) => vendor.vendorId)
  const salesLookupKeys = Array.from(
    new Set(
      vendors.map((vendor: { vendorId: string, approvedVendorId?: string }) => (
        vendor.approvedVendorId || vendor.vendorId
      ))
    )
  )

  const [salesCounts, balanceSnapshots] = await Promise.all([
    salesLookupKeys.length > 0
      ? SaleRecord.aggregate([
          {
            $match: {
              approvedVendorId: { $in: salesLookupKeys }
            }
          },
          {
            $group: {
              _id: '$approvedVendorId',
              count: { $sum: 1 }
            }
          }
        ])
      : [],
    vendorIds.length > 0
      ? BalanceSnapshot.find({ vendorId: { $in: vendorIds } })
          .select({ vendorId: 1, availableAmount: 1 })
          .lean()
      : []
  ])

  const salesCountByLookupKey = new Map<string, number>(
    (salesCounts as Array<{ _id: string, count: number }>).map(entry => [
      entry._id,
      entry.count
    ])
  )

  const balanceByVendorId = new Map<string, string>(
    (balanceSnapshots as Array<{
      vendorId: string
      availableAmount: { toString: () => string }
    }>).map(snapshot => [
      snapshot.vendorId,
      snapshot.availableAmount.toString()
    ])
  )

  return {
    vendors: vendors.map((vendor: {
      toObject: () => Record<string, unknown>
      vendorId: string
      approvedVendorId?: string
    }) => {
      const salesLookupKey = vendor.approvedVendorId || vendor.vendorId

      return {
        ...vendor.toObject(),
        totalSalesCount: salesCountByLookupKey.get(salesLookupKey) || 0,
        currentBalance: balanceByVendorId.get(vendor.vendorId) || '0.00'
      }
    })
  }
})
