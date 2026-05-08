import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { VerifiedNonVendorSource } from '../../../models/VerifiedNonVendorSource'
import { AuditEvent } from '../../../models/AuditEvent'
import { requireAdmin } from '../../../utils/adminAuth'
import { normalizeImportSource } from '../../../utils/salesImport'

const createNonVendorSourceSchema = z.object({
  sourceName: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const body = await readBody(event)
  const parsed = createNonVendorSourceSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body'
    })
  }

  const sourceName = parsed.data.sourceName.trim()
  const normalizedSource = normalizeImportSource(sourceName)

  const existing = await VerifiedNonVendorSource.findOne({ normalizedSource })
  if (existing) {
    throw createError({
      statusCode: 409,
      statusMessage: 'A verified non-vendor source with this name already exists'
    })
  }

  const nonVendorSource = await VerifiedNonVendorSource.create({
    sourceName,
    normalizedSource
  })

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'non_vendor_source_created',
    entityType: 'VerifiedNonVendorSource',
    entityId: normalizedSource,
    after: {
      sourceName: nonVendorSource.sourceName,
      normalizedSource: nonVendorSource.normalizedSource
    },
    createdAt: new Date()
  })

  return {
    message: 'Verified non-vendor source created successfully',
    nonVendorSource
  }
})
