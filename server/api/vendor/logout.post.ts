import { connectToDatabase } from '../../config/database'
import { verifyToken, revokeToken } from '../../utils/auth'
import { AuditEvent } from '../../models/AuditEvent'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const token = authHeader.substring(7)
  const payload = await verifyToken(token)

  await revokeToken(token)

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: payload.vendorId,
    actorRole: 'vendor',
    action: 'vendor_logout',
    entityType: 'Vendor',
    entityId: payload.vendorId,
    createdAt: new Date()
  })

  return { message: 'Logged out successfully' }
})
