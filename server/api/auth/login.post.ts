import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { getAccountLockoutConfig } from '../../config/auth'
import { AdminAccount } from '../../models/AdminAccount'
import { Vendor } from '../../models/Vendor'
import { AuditEvent } from '../../models/AuditEvent'
import { generateToken, verifyPassword } from '../../utils/auth'
import { formatAdminDisplayName } from '../../utils/displayName'
import { checkRateLimit, getRateLimitKey } from '../../utils/rateLimit'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = loginSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const ip = getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || 'unknown'

  const rateLimitKey = getRateLimitKey(normalizedEmail, String(ip))
  const rateLimit = checkRateLimit(rateLimitKey)

  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Please try again later.'
    })
  }

  const [admin, vendor] = await Promise.all([
    AdminAccount.findOne({ email: normalizedEmail }),
    Vendor.findOne({ email: normalizedEmail })
  ])

  if (admin && vendor) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Role conflict detected for this email. Contact support.'
    })
  }

  if (!admin && !vendor) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }

  if (admin) {
    const lockoutConfig = getAccountLockoutConfig()

    if (admin.lockoutUntil && admin.lockoutUntil <= new Date()) {
      admin.failedLoginAttempts = 0
      admin.lockoutUntil = undefined
      await admin.save()
    }

    if (admin.lockoutUntil && admin.lockoutUntil > new Date()) {
      throw createError({
        statusCode: 429,
        statusMessage: 'Account is temporarily locked. Please try again later.'
      })
    }

    if (admin.status === 'disabled') {
      throw createError({
        statusCode: 403,
        statusMessage: 'Account is disabled'
      })
    }

    const isValidPassword = await verifyPassword(password, admin.passwordHash)

    if (!isValidPassword) {
      admin.failedLoginAttempts += 1

      if (admin.failedLoginAttempts >= lockoutConfig.threshold) {
        admin.lockoutUntil = new Date(Date.now() + lockoutConfig.durationMs)
      }

      await admin.save()

      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid credentials'
      })
    }

    admin.failedLoginAttempts = 0
    admin.lockoutUntil = undefined
    admin.lastLoginAt = new Date()
    await admin.save()

    const { token } = generateToken({
      adminId: admin.adminId,
      email: admin.email,
      role: 'admin'
    })

    await AuditEvent.create({
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actorId: admin.adminId,
      actorRole: 'admin',
      action: 'admin_login',
      entityType: 'AdminAccount',
      entityId: admin.adminId,
      createdAt: new Date()
    })

    return {
      role: 'admin' as const,
      token,
      admin: {
        adminId: admin.adminId,
        displayName: formatAdminDisplayName(admin),
        email: admin.email,
        status: admin.status,
        lastLoginAt: admin.lastLoginAt
      }
    }
  }

  const activeVendor = vendor!
  const lockoutConfig = getAccountLockoutConfig()

  if (activeVendor.lockoutUntil && activeVendor.lockoutUntil <= new Date()) {
    activeVendor.failedLoginAttempts = 0
    activeVendor.lockoutUntil = undefined
    await activeVendor.save()
  }

  if (activeVendor.lockoutUntil && activeVendor.lockoutUntil > new Date()) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Account is temporarily locked. Please try again later.'
    })
  }

  if (activeVendor.status === 'inactive') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Account is inactive'
    })
  }

  const isValidPassword = await verifyPassword(password, activeVendor.passwordHash)

  if (!isValidPassword) {
    activeVendor.failedLoginAttempts += 1

    if (activeVendor.failedLoginAttempts >= lockoutConfig.threshold) {
      activeVendor.lockoutUntil = new Date(Date.now() + lockoutConfig.durationMs)
    }

    await activeVendor.save()

    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }

  activeVendor.failedLoginAttempts = 0
  activeVendor.lockoutUntil = undefined
  activeVendor.lastLoginAt = new Date()
  await activeVendor.save()

  const { token } = generateToken({
    vendorId: activeVendor.vendorId,
    email: activeVendor.email,
    role: 'vendor'
  })

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: activeVendor.vendorId,
    actorRole: 'vendor',
    action: 'vendor_login',
    entityType: 'Vendor',
    entityId: activeVendor.vendorId,
    createdAt: new Date()
  })

  return {
    role: 'vendor' as const,
    token,
    vendor: {
      vendorId: activeVendor.vendorId,
      legalName: activeVendor.legalName,
      displayName: activeVendor.displayName,
      email: activeVendor.email,
      phone: activeVendor.phone,
      preferredPayoutMethod: activeVendor.preferredPayoutMethod,
      payoutRecipientName: activeVendor.payoutRecipientName,
      paypalEmail: activeVendor.paypalEmail,
      venmoHandle: activeVendor.venmoHandle,
      approvedVendorId: activeVendor.approvedVendorId,
      status: activeVendor.status
    }
  }
})
