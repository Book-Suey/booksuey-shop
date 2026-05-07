import { z } from 'zod'
import { Vendor } from '../../models/Vendor'
import { hashPassword } from '../../utils/auth'
import { connectToDatabase } from '../../config/database'
import { AuditEvent } from '../../models/AuditEvent'

const updatePasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = updatePasswordSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const { token, password } = parsed.data

  const vendor = await Vendor.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() }
  })

  if (!vendor) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or expired reset token'
    })
  }

  // Update password
  vendor.passwordHash = await hashPassword(password)
  vendor.passwordResetToken = undefined
  vendor.passwordResetExpires = undefined
  await vendor.save()

  // Create audit event
  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: vendor.vendorId,
    actorRole: 'vendor',
    action: 'password_reset_completed',
    entityType: 'Vendor',
    entityId: vendor.vendorId,
    createdAt: new Date()
  })

  return { message: 'Password updated successfully' }
})
