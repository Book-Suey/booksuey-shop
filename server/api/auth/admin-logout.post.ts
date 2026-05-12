import { connectToDatabase } from '../../config/database'
import { verifyToken, revokeToken } from '../../utils/auth'
import { AuditEvent } from '../../models/AuditEvent'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, 'booksuey-admin-token')

  if (token) {
    await connectToDatabase()

    try {
      const payload = await verifyToken(token)

      await revokeToken(token)

      await AuditEvent.create({
        auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        actorId: payload.adminId,
        actorRole: 'admin',
        action: 'admin_logout',
        entityType: 'AdminAccount',
        entityId: payload.adminId,
        createdAt: new Date()
      })
    }
    catch {
      // Token already expired or invalid — still clear the cookie.
    }
  }

  deleteCookie(event, 'booksuey-admin-token')

  return { ok: true }
})
