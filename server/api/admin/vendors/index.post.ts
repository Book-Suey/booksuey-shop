import { z } from 'zod'
import crypto from 'crypto'
import { connectToDatabase } from '../../../config/database'
import { Vendor } from '../../../models/Vendor'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { AuditEvent } from '../../../models/AuditEvent'
import { hashPassword } from '../../../utils/auth'
import { requireAdmin } from '../../../utils/adminAuth'

const createVendorSchema = z.object({
  legalName: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  status: z.enum(['active', 'inactive']).optional(),
  approvedVendorId: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = createVendorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const normalizedEmail = parsed.data.email.toLowerCase()

  const existingVendor = await Vendor.findOne({ email: normalizedEmail })
  if (existingVendor) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A vendor with this email already exists'
    })
  }

  let approvedVendorId = parsed.data.approvedVendorId

  if (approvedVendorId) {
    const approvedVendor = await ApprovedVendor.findOne({ basilId: approvedVendorId })
    if (!approvedVendor) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Approved vendor record not found'
      })
    }
  } else {
    const approvedVendor = await ApprovedVendor.findOne({ email: normalizedEmail })
    approvedVendorId = approvedVendor?.basilId
  }

  const passwordHash = await hashPassword(parsed.data.password)

  const vendorId = `vendor_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

  const vendor = await Vendor.create({
    vendorId,
    legalName: parsed.data.legalName,
    displayName: parsed.data.displayName,
    email: normalizedEmail,
    phone: parsed.data.phone,
    passwordHash,
    status: parsed.data.status || 'active',
    approvedVendorId
  })

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'vendor_created',
    entityType: 'Vendor',
    entityId: vendor.vendorId,
    after: {
      vendorId: vendor.vendorId,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      email: vendor.email,
      phone: vendor.phone,
      status: vendor.status,
      approvedVendorId: vendor.approvedVendorId
    },
    createdAt: new Date()
  })

  return {
    message: 'Vendor created successfully',
    vendor: {
      vendorId: vendor.vendorId,
      legalName: vendor.legalName,
      displayName: vendor.displayName,
      email: vendor.email,
      phone: vendor.phone,
      status: vendor.status,
      approvedVendorId: vendor.approvedVendorId,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    }
  }
})
