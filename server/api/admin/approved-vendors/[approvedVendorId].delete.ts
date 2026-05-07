import { connectToDatabase } from '../../../config/database'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { AuditEvent } from '../../../models/AuditEvent'
import { requireAdmin } from '../../../utils/adminAuth'

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

  const approvedVendor = await ApprovedVendor.findOne({ basilId: approvedVendorId })
  if (!approvedVendor) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Approved vendor not found'
    })
  }

  const before = {
    basilId: approvedVendor.basilId,
    firstName: approvedVendor.firstName,
    lastName: approvedVendor.lastName,
    email: approvedVendor.email,
    phone: approvedVendor.phone
  }

  await approvedVendor.deleteOne()

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'approved_vendor_deleted',
    entityType: 'ApprovedVendor',
    entityId: approvedVendorId,
    before,
    createdAt: new Date()
  })

  return {
    message: 'Approved vendor deleted successfully'
  }
})
