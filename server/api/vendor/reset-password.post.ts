import { z } from 'zod'
import { Vendor } from '../../models/Vendor'
import { getPasswordResetExpiryMs } from '../../config/auth'
import { connectToDatabase } from '../../config/database'
import { AuditEvent } from '../../models/AuditEvent'
import crypto from 'crypto'

const resetRequestSchema = z.object({
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = resetRequestSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const { email } = parsed.data

  // Find vendor (don't reveal if not found)
  const vendor = await Vendor.findOne({ email: email.toLowerCase() })

  if (!vendor) {
    // Return success anyway to not reveal email existence
    return { message: 'If the email exists, a reset link has been sent.' }
  }

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex')
  const resetExpires = new Date(Date.now() + getPasswordResetExpiryMs())

  vendor.passwordResetToken = resetToken
  vendor.passwordResetExpires = resetExpires
  await vendor.save()

  // Create audit event
  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: vendor.vendorId,
    actorRole: 'vendor',
    action: 'password_reset_requested',
    entityType: 'Vendor',
    entityId: vendor.vendorId,
    createdAt: new Date()
  })

  // TODO: Send email via Mailgun
  // For now, return the token for testing purposes
  // In production, this would be sent via email

  return {
    message: 'If the email exists, a reset link has been sent.',
    // Only include token in development
    ...(process.env.NODE_ENV !== 'production' && { resetToken })
  }
})
