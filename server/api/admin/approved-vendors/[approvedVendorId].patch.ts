import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { Vendor } from '../../../models/Vendor'
import { AuditEvent } from '../../../models/AuditEvent'
import { requireAdmin } from '../../../utils/adminAuth'

const updateApprovedVendorSchema = z.object({
  basilId: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required'
})

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const approvedVendorId = getRouterParam(event, 'approvedVendorId')
  if (!approvedVendorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Approved vendor identifier is required'
    })
  }

  const body = await readBody(event)
  const parsed = updateApprovedVendorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const approvedVendor = await ApprovedVendor.findOne({ basilId: approvedVendorId })
  if (!approvedVendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Approved vendor not found'
    })
  }

  const updateData = { ...parsed.data }
  if (updateData.email) {
    updateData.email = updateData.email.toLowerCase()

    const duplicate = await ApprovedVendor.findOne({
      email: updateData.email,
      basilId: { $ne: approvedVendorId }
    })

    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: 'An approved vendor with this email already exists'
      })
    }
  }

  if (updateData.basilId) {
    const duplicateBasilId = await ApprovedVendor.findOne({
      basilId: updateData.basilId,
      _id: { $ne: approvedVendor._id }
    })

    if (duplicateBasilId) {
      throw createError({
        statusCode: 409,
        statusMessage: 'An approved vendor with this basilId already exists'
      })
    }
  }

  const before = {
    basilId: approvedVendor.basilId,
    firstName: approvedVendor.firstName,
    lastName: approvedVendor.lastName,
    email: approvedVendor.email,
    phone: approvedVendor.phone
  }

  const hasChanges = (
    (updateData.basilId !== undefined && updateData.basilId !== approvedVendor.basilId)
    || (updateData.firstName !== undefined && updateData.firstName !== approvedVendor.firstName)
    || (updateData.lastName !== undefined && updateData.lastName !== approvedVendor.lastName)
    || (updateData.email !== undefined && updateData.email !== approvedVendor.email)
    || (updateData.phone !== undefined && updateData.phone !== approvedVendor.phone)
  )

  if (!hasChanges) {
    return {
      message: 'No changes detected',
      approvedVendor
    }
  }

  const previousBasilId = approvedVendor.basilId

  Object.assign(approvedVendor, updateData)
  await approvedVendor.save()

  if (previousBasilId !== approvedVendor.basilId) {
    await Vendor.updateMany(
      { approvedVendorId: previousBasilId },
      { $set: { approvedVendorId: approvedVendor.basilId } }
    )
  }

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'approved_vendor_updated',
    entityType: 'ApprovedVendor',
    entityId: approvedVendor.basilId,
    before,
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
    message: 'Approved vendor updated successfully',
    approvedVendor
  }
})
