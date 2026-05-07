import crypto from 'crypto'
import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { getPasswordResetExpiryMs } from '../../../config/auth'
import { AdminAccount } from '../../../models/AdminAccount'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { AuditEvent } from '../../../models/AuditEvent'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'
import { hashPassword } from '../../../utils/auth'
import { sendVendorInviteEmail } from '../../../utils/email'

const inviteVendorSchema = z.object({
  approvedVendorId: z.string().min(1)
})

function buildVendorIdentity(approvedVendor: {
  firstName: string
  lastName: string
  email: string
  basilId: string
  phone?: string
}): {
  legalName: string
  displayName: string
} {
  const fullName = `${approvedVendor.firstName} ${approvedVendor.lastName}`.trim()

  return {
    legalName: fullName,
    displayName: fullName
  }
}

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = inviteVendorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const approvedVendorId = parsed.data.approvedVendorId.trim()

  const approvedVendor = await ApprovedVendor.findOne({ basilId: approvedVendorId })
  if (!approvedVendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Approved vendor record not found'
    })
  }

  const normalizedEmail = approvedVendor.email.toLowerCase()
  const existingAdmin = await AdminAccount.findOne({ email: normalizedEmail })

  if (existingAdmin) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An admin account with this email already exists'
    })
  }

  let vendor = await Vendor.findOne({ approvedVendorId: approvedVendor.basilId })

  if (!vendor) {
    vendor = await Vendor.findOne({ email: normalizedEmail })
  }

  if (!vendor) {
    const identity = buildVendorIdentity(approvedVendor)
    const temporaryPassword = crypto.randomBytes(32).toString('hex')

    vendor = await Vendor.create({
      vendorId: `vendor_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      legalName: identity.legalName,
      displayName: identity.displayName,
      email: normalizedEmail,
      phone: approvedVendor.phone,
      passwordHash: await hashPassword(temporaryPassword),
      status: 'active',
      approvedVendorId: approvedVendor.basilId
    })
  } else if (!vendor.approvedVendorId) {
    vendor.approvedVendorId = approvedVendor.basilId
  }

  const resetToken = crypto.randomBytes(32).toString('hex')
  const resetExpires = new Date(Date.now() + getPasswordResetExpiryMs())

  vendor.passwordResetToken = resetToken
  vendor.passwordResetExpires = resetExpires
  await vendor.save()

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'vendor_invited',
    entityType: 'Vendor',
    entityId: vendor.vendorId,
    after: {
      vendorId: vendor.vendorId,
      approvedVendorId: vendor.approvedVendorId,
      email: vendor.email,
      resetExpiresAt: resetExpires.toISOString()
    },
    createdAt: new Date()
  })

  const invitePath = `/reset-password?token=${resetToken}`
  const inviteName = `${approvedVendor.firstName} ${approvedVendor.lastName}`.trim()

  const inviteEmailResult = await sendVendorInviteEmail({
    recipientEmail: vendor.email,
    recipientName: inviteName,
    invitePath,
    expiresAt: resetExpires
  })

  return {
    message: 'Vendor invite prepared successfully',
    vendor: {
      vendorId: vendor.vendorId,
      approvedVendorId: vendor.approvedVendorId,
      email: vendor.email
    },
    invitePath,
    inviteEmail: inviteEmailResult,
    ...(process.env.NODE_ENV !== 'production' && { inviteToken: resetToken })
  }
})
