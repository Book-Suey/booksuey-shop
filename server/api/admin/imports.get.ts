import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { SalesImportBatch } from '../../models/SalesImportBatch'
import { getAdminDisplayNameMap } from '../../utils/displayName'
import { requireAdmin } from '../../utils/adminAuth'

const importsQuerySchema = z.object({
  status: z.enum(['completed', 'failed']).optional(),
  sourcePeriod: z.string().trim().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const query = getQuery(event)
  const parsedQuery = importsQuerySchema.safeParse(query)

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters'
    })
  }

  const filters: {
    status?: 'completed' | 'failed'
    sourcePeriod?: string
    uploadedAt?: { $gte?: Date, $lte?: Date }
  } = {}

  if (parsedQuery.data.status) {
    filters.status = parsedQuery.data.status
  }

  if (parsedQuery.data.sourcePeriod) {
    filters.sourcePeriod = parsedQuery.data.sourcePeriod
  }

  if (parsedQuery.data.dateFrom || parsedQuery.data.dateTo) {
    filters.uploadedAt = {}

    if (parsedQuery.data.dateFrom) {
      filters.uploadedAt.$gte = new Date(parsedQuery.data.dateFrom)
    }

    if (parsedQuery.data.dateTo) {
      filters.uploadedAt.$lte = new Date(parsedQuery.data.dateTo)
    }
  }

  const limit = parsedQuery.data.limit ?? 100
  const imports = await SalesImportBatch.find(filters).sort({ uploadedAt: -1, _id: -1 }).limit(limit)
  const uploadedByMap = await getAdminDisplayNameMap(
    imports.map((batch: { uploadedBy: string }) => batch.uploadedBy)
  )

  return {
    imports: imports.map((batch: {
      batchId: string
      sourcePeriod: string
      uploadedBy: string
      uploadedAt: Date
      status: 'completed' | 'failed'
      totalRows: number
      acceptedRows: number
      rejectedRows: number
      nonVendorRejectedRows: number
      duplicateRows: number
      errors: Array<{ code: string, rowNumber: number, reason: string, hint: string }>
      unmappedSources: string[]
      nonVendorSources: string[]
    }) => ({
      batchId: batch.batchId,
      sourcePeriod: batch.sourcePeriod,
      uploadedBy: uploadedByMap.get(batch.uploadedBy) || batch.uploadedBy,
      uploadedAt: batch.uploadedAt,
      status: batch.status,
      summary: {
        total: batch.totalRows,
        accepted: batch.acceptedRows,
        rejected: batch.rejectedRows,
        nonVendorRejected: batch.nonVendorRejectedRows,
        duplicates: batch.duplicateRows
      },
      errors: batch.errors,
      unmappedSources: batch.unmappedSources,
      nonVendorSources: batch.nonVendorSources
    }))
  }
})
