import { verifyToken, generateToken } from '../../utils/auth'
import { Vendor } from '../../models/Vendor'
import { connectToDatabase } from '../../config/database'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const oldToken = authHeader.substring(7)
  const payload = await verifyToken(oldToken)

  // Verify vendor still exists and is active
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

  // Generate new token
  const { token } = generateToken({
    vendorId: vendor.vendorId,
    email: vendor.email,
    role: 'vendor'
  })

  return { token }
})
