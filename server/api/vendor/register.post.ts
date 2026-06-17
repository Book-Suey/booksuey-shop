import { z } from 'zod'
import { Vendor } from '../../models/Vendor'
import { AdminAccount } from '../../models/AdminAccount'
import { ApprovedVendor } from '../../models/ApprovedVendor'
import { hashPassword } from '../../utils/auth'
import { connectToDatabase } from '../../config/database'
import { AuditEvent } from '../../models/AuditEvent'
import crypto from 'crypto'

const registerSchema = z.object({
  legalName: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = registerSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const { legalName, displayName, email, phone, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  // Check for existing vendor with same email
  const existingVendor = await Vendor.findOne({ email: normalizedEmail })
  if (existingVendor) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A vendor with this email already exists'
    })
  }

  const existingAdmin = await AdminAccount.findOne({ email: normalizedEmail })
  if (existingAdmin) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An admin account with this email already exists'
    })
  }

  // Require approved vendor match before allowing signup
  const approvedVendor = await ApprovedVendor.findOne({
    email: normalizedEmail
  })
  if (!approvedVendor) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Registration is only available to approved vendors'
    })
  }

  // Hash password
  const passwordHash = await hashPassword(password)

  // Generate vendor ID
  const vendorId = `vendor_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

  // Create vendor
  const vendor = await Vendor.create({
    vendorId,
    legalName,
    displayName,
    email: normalizedEmail,
    phone,
    passwordHash,
    status: 'active',
    approvedVendorId: approvedVendor?.basilId
  })

  // Create audit event
  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: vendorId,
    actorRole: 'vendor',
    action: 'vendor_registered',
    entityType: 'Vendor',
    entityId: vendorId,
    after: {
      vendorId,
      legalName,
      displayName,
      email: normalizedEmail,
      autoLinked: !!approvedVendor
    },
    createdAt: new Date()
  })

  // TODO: Send welcome email via Mailgun

  return {
    message: 'Vendor registered successfully',
    vendor: {
      vendorId: vendor.vendorId,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      email: vendor.email,
      autoLinked: !!approvedVendor
    }
  }
})
