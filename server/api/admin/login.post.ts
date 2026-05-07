import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { getAccountLockoutConfig } from '../../config/auth'
import { AdminAccount } from '../../models/AdminAccount'
import { Vendor } from '../../models/Vendor'
import { AuditEvent } from '../../models/AuditEvent'
import { generateToken, verifyPassword } from '../../utils/auth'
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

  const admin = await AdminAccount.findOne({ email: normalizedEmail })
  const vendor = await Vendor.findOne({ email: normalizedEmail })

  if (admin && vendor) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Role conflict detected for this email. Contact support.'
    })
  }

  if (!admin) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }

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
    token,
    admin: {
      adminId: admin.adminId,
      email: admin.email,
      status: admin.status,
      lastLoginAt: admin.lastLoginAt
    }
  }
})
