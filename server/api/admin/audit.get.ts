import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { AuditEvent } from '../../models/AuditEvent'
import { requireAdmin } from '../../utils/adminAuth'

const auditQuerySchema = z.object({
  action: z.union([z.string(), z.array(z.string())]).optional(),
  entityType: z.union([z.string(), z.array(z.string())]).optional(),
  entityId: z.string().trim().optional(),
  actorRole: z.enum(['admin', 'vendor']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

function asArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }

  return (Array.isArray(value) ? value : value.split(','))
    .map(item => item.trim())
    .filter(Boolean)
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const query = getQuery(event)
  const parsedQuery = auditQuerySchema.safeParse(query)

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters'
    })
  }

  const actions = asArray(parsedQuery.data.action)
  const entityTypes = asArray(parsedQuery.data.entityType)
  const filters: {
    action?: { $in: string[] }
    entityType?: { $in: string[] }
    entityId?: string
    actorRole?: 'admin' | 'vendor'
    createdAt?: { $gte?: Date, $lte?: Date }
  } = {}

  if (actions?.length) {
    filters.action = { $in: actions }
  }

  if (entityTypes?.length) {
    filters.entityType = { $in: entityTypes }
  }

  if (parsedQuery.data.entityId) {
    filters.entityId = parsedQuery.data.entityId
  }

  if (parsedQuery.data.actorRole) {
    filters.actorRole = parsedQuery.data.actorRole
  }

  if (parsedQuery.data.dateFrom || parsedQuery.data.dateTo) {
    filters.createdAt = {}

    if (parsedQuery.data.dateFrom) {
      filters.createdAt.$gte = new Date(parsedQuery.data.dateFrom)
    }

    if (parsedQuery.data.dateTo) {
      filters.createdAt.$lte = new Date(parsedQuery.data.dateTo)
    }
  }

  const limit = parsedQuery.data.limit ?? 100
  const auditEvents = await AuditEvent.find(filters).sort({ createdAt: -1, _id: -1 }).limit(limit)

  return {
    auditEvents: auditEvents.map((auditEvent: {
      auditEventId: string
      actorId: string
      actorRole: 'admin' | 'vendor'
      action: string
      entityType: string
      entityId: string
      before?: Record<string, unknown>
      after?: Record<string, unknown>
      createdAt: Date
    }) => ({
      auditEventId: auditEvent.auditEventId,
      actorId: auditEvent.actorId,
      actorRole: auditEvent.actorRole,
      action: auditEvent.action,
      entityType: auditEvent.entityType,
      entityId: auditEvent.entityId,
      before: auditEvent.before,
      after: auditEvent.after,
      createdAt: auditEvent.createdAt
    }))
  }
})
