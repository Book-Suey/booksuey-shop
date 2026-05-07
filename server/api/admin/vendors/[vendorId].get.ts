import { connectToDatabase } from '../../../config/database'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'

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
  })
    .select('-passwordHash -passwordResetToken -passwordResetExpires')

  if (!vendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Vendor not found'
    })
  }

  return {
    vendor
  }
})
