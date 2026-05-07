import { connectToDatabase } from '../../config/database'
import { Vendor } from '../../models/Vendor'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorId = event.context.vendorId as string | undefined
  if (!vendorId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const vendor = await Vendor.findOne({
    vendorId,
    status: 'active'
  })

  if (!vendor) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Vendor not found or inactive'
    })
  }

  return {
    vendor: {
      vendorId: vendor.vendorId,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      email: vendor.email,
      phone: vendor.phone,
      status: vendor.status,
      approvedVendorId: vendor.approvedVendorId,
      lastLoginAt: vendor.lastLoginAt,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    }
  }
})
