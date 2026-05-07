import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { Vendor } from '../../../models/Vendor'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { AuditEvent } from '../../../models/AuditEvent'
import { hashPassword } from '../../../utils/auth'
import { requireAdmin } from '../../../utils/adminAuth'

const updateVendorSchema = z.object({
  legalName: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(8).optional(),
  approvedVendorId: z.string().optional()
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field is required'
})

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const vendorId = getRouterParam(event, 'vendorId')
  if (!vendorId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Vendor identifier is required'
    })
  }

  const body = await readBody(event)
  const parsed = updateVendorSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const vendor = await Vendor.findOne({
    $or: [
      { vendorId },
      { approvedVendorId: vendorId }
    ]
  })
  if (!vendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Vendor not found'
    })
  }

  const updateData = { ...parsed.data }

  if (updateData.email) {
    updateData.email = updateData.email.toLowerCase()

    const duplicate = await Vendor.findOne({
      email: updateData.email,
      vendorId: { $ne: vendor.vendorId }
    })

    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A vendor with this email already exists'
      })
    }
  }

  if (updateData.approvedVendorId) {
    const approvedVendor = await ApprovedVendor.findOne({ basilId: updateData.approvedVendorId })
    if (!approvedVendor) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Approved vendor record not found'
      })
    }
  }

  const before = {
    vendorId: vendor.vendorId,
    legalName: vendor.legalName,
    displayName: vendor.displayName,
    email: vendor.email,
    phone: vendor.phone,
    status: vendor.status,
    approvedVendorId: vendor.approvedVendorId
  }

  const hasProfileChanges = (
    (updateData.legalName !== undefined && updateData.legalName !== vendor.legalName)
    || (updateData.displayName !== undefined && updateData.displayName !== vendor.displayName)
    || (updateData.email !== undefined && updateData.email !== vendor.email)
    || (updateData.phone !== undefined && updateData.phone !== vendor.phone)
    || (updateData.status !== undefined && updateData.status !== vendor.status)
    || (updateData.approvedVendorId !== undefined && updateData.approvedVendorId !== vendor.approvedVendorId)
  )

  const hasPasswordChange = updateData.password !== undefined

  if (!hasProfileChanges && !hasPasswordChange) {
    return {
      message: 'No changes detected',
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
  }

  if (updateData.legalName !== undefined) {
    vendor.legalName = updateData.legalName
  }
  if (updateData.displayName !== undefined) {
    vendor.displayName = updateData.displayName
  }
  if (updateData.email !== undefined) {
    vendor.email = updateData.email
  }
  if (updateData.phone !== undefined) {
    vendor.phone = updateData.phone
  }
  if (updateData.status !== undefined) {
    vendor.status = updateData.status
  }
  if (updateData.approvedVendorId !== undefined) {
    vendor.approvedVendorId = updateData.approvedVendorId
  }
  if (updateData.password !== undefined) {
    vendor.passwordHash = await hashPassword(updateData.password)
  }

  await vendor.save()

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'vendor_updated',
    entityType: 'Vendor',
    entityId: vendor.vendorId,
    before,
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
    message: 'Vendor updated successfully',
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
