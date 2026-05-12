import { connectToDatabase } from '../../../config/database'
import { ApprovedVendor, type IApprovedVendor } from '../../../models/ApprovedVendor'
import { SaleRecord } from '../../../models/SaleRecord'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'

interface ApprovedVendorWithLinkStatus extends IApprovedVendor {
  isLinked: boolean
  linkedVendorId: string | null
  totalSalesCount: number
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const approvedVendors = await ApprovedVendor.find({}).lean().sort({ lastName: 1, firstName: 1 })
  const basilIds = approvedVendors.map((vendor: IApprovedVendor) => vendor.basilId)

  const salesCounts: Array<{ _id: string, count: number }> = basilIds.length > 0
    ? await SaleRecord.aggregate([
        {
          $match: {
            approvedVendorId: { $in: basilIds }
          }
        },
        {
          $group: {
            _id: '$approvedVendorId',
            count: { $sum: 1 }
          }
        }
      ])
    : []

  const salesCountByBasilId = new Map<string, number>(
    salesCounts.map((entry: { _id: string, count: number }) => [entry._id, entry.count])
  )

  // For each approved vendor, check if it's linked to a vendor account
  const vendorsWithLinkStatus: ApprovedVendorWithLinkStatus[] = await Promise.all(
    approvedVendors.map(async (av: IApprovedVendor) => {
      const linkedVendor = await Vendor.findOne({ approvedVendorId: av.basilId })
      return {
        ...av,
        isLinked: !!linkedVendor,
        linkedVendorId: linkedVendor?.vendorId || null,
        totalSalesCount: salesCountByBasilId.get(av.basilId) || 0
      }
    })
  )

  return {
    approvedVendors: vendorsWithLinkStatus.map(vendor => ({
      ...vendor,
      approvedVendorName: `${vendor.firstName} ${vendor.lastName}`.trim()
    }))
  }
})
