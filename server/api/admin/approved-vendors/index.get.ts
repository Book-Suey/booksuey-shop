import { connectToDatabase } from '../../../config/database'
import { ApprovedVendor, type IApprovedVendor } from '../../../models/ApprovedVendor'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'

interface ApprovedVendorWithLinkStatus extends IApprovedVendor {
  isLinked: boolean
  linkedVendorId: string | null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const approvedVendors = await ApprovedVendor.find({}).lean().sort({ lastName: 1, firstName: 1 })

  // For each approved vendor, check if it's linked to a vendor account
  const vendorsWithLinkStatus: ApprovedVendorWithLinkStatus[] = await Promise.all(
    approvedVendors.map(async (av: IApprovedVendor) => {
      const linkedVendor = await Vendor.findOne({ approvedVendorId: av.basilId })
      return {
        ...av,
        isLinked: !!linkedVendor,
        linkedVendorId: linkedVendor?.vendorId || null
      }
    })
  )

  return {
    approvedVendors: vendorsWithLinkStatus
  }
})
