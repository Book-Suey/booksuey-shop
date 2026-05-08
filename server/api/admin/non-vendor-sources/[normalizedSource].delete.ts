import { connectToDatabase } from '../../../config/database'
import { VerifiedNonVendorSource } from '../../../models/VerifiedNonVendorSource'
import { AuditEvent } from '../../../models/AuditEvent'
import { requireAdmin } from '../../../utils/adminAuth'

function decodeRouteParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const rawNormalizedSource = getRouterParam(event, 'normalizedSource')
  if (!rawNormalizedSource) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Verified non-vendor source identifier is required'
    })
  }

  const normalizedSourceParam = decodeRouteParam(rawNormalizedSource)

  const nonVendorSource = await VerifiedNonVendorSource.findOne({
    normalizedSource: normalizedSourceParam
  })

  if (!nonVendorSource) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Verified non-vendor source not found'
    })
  }

  const before = {
    sourceName: nonVendorSource.sourceName,
    normalizedSource: nonVendorSource.normalizedSource
  }

  await nonVendorSource.deleteOne()

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'non_vendor_source_deleted',
    entityType: 'VerifiedNonVendorSource',
    entityId: normalizedSourceParam,
    before,
    createdAt: new Date()
  })

  return {
    message: 'Verified non-vendor source deleted successfully'
  }
})
