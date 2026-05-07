import { Vendor } from '../models/Vendor'
import { connectToDatabase } from '../config/database'
import { verifyToken } from '../utils/auth'

export default defineEventHandler(async (event) => {
  const path = event.path

  // Only apply to vendor API routes that need authentication
  const isProtectedRoute = path.startsWith('/api/vendor/')
    && !path.startsWith('/api/vendor/login')
    && !path.startsWith('/api/vendor/register')
    && !path.startsWith('/api/vendor/reset-password')
    && !path.startsWith('/api/vendor/verify-reset-token')

  if (!isProtectedRoute) {
    return
  }

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - No token provided'
    })
  }

  const token = authHeader.substring(7)
  const payload = await verifyToken(token)

  if (payload.role !== 'vendor') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  if (!payload.vendorId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Invalid vendor token'
    })
  }

  await connectToDatabase()

  const vendor = await Vendor.findOne({
    vendorId: payload.vendorId,
    status: 'active'
  })

  if (!vendor) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Vendor not found or inactive'
    })
  }

  // Attach vendor info to event context
  event.context.vendorId = payload.vendorId
  event.context.vendorRole = payload.role
  event.context.vendor = {
    vendorId: vendor.vendorId,
    legalName: vendor.legalName,
    displayName: vendor.displayName,
    email: vendor.email,
    status: vendor.status,
    approvedVendorId: vendor.approvedVendorId
  }
})
