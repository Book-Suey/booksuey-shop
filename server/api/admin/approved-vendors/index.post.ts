import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { AuditEvent } from '../../../models/AuditEvent'
import { requireAdmin } from '../../../utils/adminAuth'

const createApprovedVendorSchema = z.object({
  basilId: z.string().min(1),
  lastName: z.string().min(1),
  firstName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email()
})

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = createApprovedVendorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const approvedVendorData = {
    ...parsed.data,
    email: parsed.data.email.toLowerCase()
  }

  const existingByEmail = await ApprovedVendor.findOne({ email: approvedVendorData.email })
  if (existingByEmail) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An approved vendor with this email already exists'
    })
  }

  const existingByBasilId = await ApprovedVendor.findOne({ basilId: approvedVendorData.basilId })
  if (existingByBasilId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'An approved vendor with this basilId already exists'
    })
  }

  const approvedVendor = await ApprovedVendor.create(approvedVendorData)

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'approved_vendor_created',
    entityType: 'ApprovedVendor',
    entityId: approvedVendor.basilId,
    after: {
      basilId: approvedVendor.basilId,
      firstName: approvedVendor.firstName,
      lastName: approvedVendor.lastName,
      email: approvedVendor.email,
      phone: approvedVendor.phone
    },
    createdAt: new Date()
  })

  return {
    message: 'Approved vendor created successfully',
    approvedVendor
  }
})
