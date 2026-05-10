import { z } from 'zod'
import { Vendor } from '../../models/Vendor'
import { AdminAccount } from '../../models/AdminAccount'
import { getPasswordResetExpiryMs } from '../../config/auth'
import { connectToDatabase } from '../../config/database'
import { AuditEvent } from '../../models/AuditEvent'
import { sendAdminPasswordResetEmail, sendVendorPasswordResetEmail } from '../../utils/email'
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

  const normalizedEmail = parsed.data.email.toLowerCase()

  // Unified reset lookup order: vendor first, then admin.
  const vendor = await Vendor.findOne({ email: normalizedEmail })

  if (vendor) {
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + getPasswordResetExpiryMs())
    const resetPath = `/reset-password?token=${resetToken}`

    vendor.passwordResetToken = resetToken
    vendor.passwordResetExpires = resetExpires
    await vendor.save()

    try {
      const deliveryResult = await sendVendorPasswordResetEmail({
        recipientEmail: vendor.email,
        recipientName: vendor.displayName || vendor.legalName,
        resetPath,
        expiresAt: resetExpires
      })

      if (!deliveryResult.delivered) {
        console.warn('Password reset email was not delivered', {
          actorRole: 'vendor',
          actorId: vendor.vendorId,
          reason: deliveryResult.skippedReason ?? 'Unknown reason'
        })
      }
    } catch (emailError: unknown) {
      console.warn('Password reset email delivery failed', emailError)
    }

    await AuditEvent.create({
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actorId: vendor.vendorId,
      actorRole: 'vendor',
      action: 'password_reset_requested',
      entityType: 'Vendor',
      entityId: vendor.vendorId,
      createdAt: new Date()
    })

    return {
      message: 'If the email exists, a reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' && { resetToken })
    }
  }

  const admin = await AdminAccount.findOne({ email: normalizedEmail })

  if (admin) {
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetExpires = new Date(Date.now() + getPasswordResetExpiryMs())
    const resetPath = `/reset-password?token=${resetToken}`

    admin.passwordResetToken = resetToken
    admin.passwordResetExpires = resetExpires
    await admin.save()

    try {
      const deliveryResult = await sendAdminPasswordResetEmail({
        recipientEmail: admin.email,
        recipientName: admin.displayName || admin.email,
        resetPath,
        expiresAt: resetExpires
      })

      if (!deliveryResult.delivered) {
        console.warn('Password reset email was not delivered', {
          actorRole: 'admin',
          actorId: admin.adminId,
          reason: deliveryResult.skippedReason ?? 'Unknown reason'
        })
      }
    } catch (emailError: unknown) {
      console.warn('Password reset email delivery failed', emailError)
    }

    await AuditEvent.create({
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actorId: admin.adminId,
      actorRole: 'admin',
      action: 'password_reset_requested',
      entityType: 'AdminAccount',
      entityId: admin.adminId,
      createdAt: new Date()
    })

    return {
      message: 'If the email exists, a reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' && { resetToken })
    }
  }

  return { message: 'If the email exists, a reset link has been sent.' }
})
