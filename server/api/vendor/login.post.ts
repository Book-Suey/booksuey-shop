import { z } from 'zod'
import { Vendor } from '../../models/Vendor'
import { checkRateLimit, getRateLimitKey } from '../../utils/rateLimit'
import { verifyPassword, generateToken } from '../../utils/auth'
import { getAccountLockoutConfig } from '../../config/auth'
import { AuditEvent } from '../../models/AuditEvent'
import { connectToDatabase } from '../../config/database'

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
  const ip = getHeader(event, 'x-forwarded-for') || getHeader(event, 'x-real-ip') || 'unknown'

  // Rate limiting check
  const rateLimitKey = getRateLimitKey(email, String(ip))
  const rateLimit = checkRateLimit(rateLimitKey)

  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts. Please try again later.'
    })
  }

  // Find vendor
  const vendor = await Vendor.findOne({
    email: email.toLowerCase()
  })

  if (!vendor) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }

  // Check account lockout
  const lockoutConfig = getAccountLockoutConfig()
  if (vendor.lockoutUntil && vendor.lockoutUntil <= new Date()) {
    vendor.failedLoginAttempts = 0
    vendor.lockoutUntil = undefined
    await vendor.save()
  }

  if (vendor.lockoutUntil && vendor.lockoutUntil > new Date()) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Account is temporarily locked. Please try again later.'
    })
  }

  // Check account status
  if (vendor.status === 'inactive') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Account is inactive'
    })
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, vendor.passwordHash)

  if (!isValidPassword) {
    // Increment failed attempts
    vendor.failedLoginAttempts += 1

    // Check for lockout threshold
    if (vendor.failedLoginAttempts >= lockoutConfig.threshold) {
      vendor.lockoutUntil = new Date(Date.now() + lockoutConfig.durationMs)
    }

    await vendor.save()

    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid credentials'
    })
  }

  // Reset failed attempts on successful login
  vendor.failedLoginAttempts = 0
  vendor.lockoutUntil = undefined
  vendor.lastLoginAt = new Date()
  await vendor.save()

  // Generate token
  const { token } = generateToken({
    vendorId: vendor.vendorId,
    email: vendor.email,
    role: 'vendor'
  })

  // Create audit event
  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: vendor.vendorId,
    actorRole: 'vendor',
    action: 'vendor_login',
    entityType: 'Vendor',
    entityId: vendor.vendorId,
    createdAt: new Date()
  })

  return {
    token,
    vendor: {
      vendorId: vendor.vendorId,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      email: vendor.email,
      status: vendor.status
    }
  }
})
