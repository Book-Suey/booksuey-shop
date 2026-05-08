import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { VerifiedNonVendorSource } from '../../../models/VerifiedNonVendorSource'
import { AuditEvent } from '../../../models/AuditEvent'
import { requireAdmin } from '../../../utils/adminAuth'
import { normalizeImportSource } from '../../../utils/salesImport'

const updateNonVendorSourceSchema = z.object({
  sourceName: z.string().min(1)
})

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

  const body = await readBody(event)
  const parsed = updateNonVendorSourceSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const nonVendorSource = await VerifiedNonVendorSource.findOne({
    normalizedSource: normalizedSourceParam
  })

  if (!nonVendorSource) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Verified non-vendor source not found'
    })
  }

  const sourceName = parsed.data.sourceName.trim()
  const normalizedSource = normalizeImportSource(sourceName)

  if (normalizedSource !== nonVendorSource.normalizedSource) {
    const duplicate = await VerifiedNonVendorSource.findOne({ normalizedSource })
    if (duplicate) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A verified non-vendor source with this name already exists'
      })
    }
  }

  const before = {
    sourceName: nonVendorSource.sourceName,
    normalizedSource: nonVendorSource.normalizedSource
  }

  const hasChanges = sourceName !== nonVendorSource.sourceName || normalizedSource !== nonVendorSource.normalizedSource

  if (!hasChanges) {
    return {
      message: 'No changes detected',
      nonVendorSource
    }
  }

  nonVendorSource.sourceName = sourceName
  nonVendorSource.normalizedSource = normalizedSource
  await nonVendorSource.save()

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'non_vendor_source_updated',
    entityType: 'VerifiedNonVendorSource',
    entityId: normalizedSource,
    before,
    after: {
      sourceName: nonVendorSource.sourceName,
      normalizedSource: nonVendorSource.normalizedSource
    },
    createdAt: new Date()
  })

  return {
    message: 'Verified non-vendor source updated successfully',
    nonVendorSource
  }
})
