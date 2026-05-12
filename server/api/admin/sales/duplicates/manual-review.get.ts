import { z } from 'zod'
import { connectToDatabase } from '../../../../config/database'
import { requireAdmin } from '../../../../utils/adminAuth'
import { SalesImportBatch } from '../../../../models/SalesImportBatch'
import { getAdminDisplayNameMap } from '../../../../utils/displayName'

const manualReviewQuerySchema = z.object({
  sourcePeriod: z.string().trim().optional(),
  batchId: z.string().trim().optional(),
  duplicateKind: z.enum(['within-upload', 'existing-sale']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const query = getQuery(event)
  const parsedQuery = manualReviewQuerySchema.safeParse(query)

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters'
    })
  }

  const filters: {
    sourcePeriod?: string
    batchId?: string
  } = {}

  if (parsedQuery.data.sourcePeriod) {
    filters.sourcePeriod = parsedQuery.data.sourcePeriod
  }

  if (parsedQuery.data.batchId) {
    filters.batchId = parsedQuery.data.batchId
  }

  const dateFrom = parsedQuery.data.dateFrom
    ? new Date(parsedQuery.data.dateFrom)
    : undefined
  const dateTo = parsedQuery.data.dateTo
    ? new Date(parsedQuery.data.dateTo)
    : undefined

  const limit = parsedQuery.data.limit ?? 100
  const batches = await SalesImportBatch.find({
    ...filters,
    'duplicateDetails.manualImportStatus': 'requested'
  }).sort({ uploadedAt: -1, _id: -1 })

  const rows = [] as Array<{
    batchId: string
    sourcePeriod: string
    uploadedAt: Date
    rowNumber: number
    source: string
    saleOrderId: string
    title: string
    quantity: number
    extended: string
    soldAt: Date
    duplicateKind: 'within-upload' | 'existing-sale'
    matchedRowNumber?: number
    existingBatchId?: string
    manualImportStatus: 'not_requested' | 'requested' | 'imported'
    manualImportRequestedAt?: Date
    manualImportRequestedBy?: string
    manualImportImportedAt?: Date
    manualImportImportedBy?: string
    manualImportSaleRecordId?: string
  }>

  for (const batch of batches) {
    for (const duplicateDetail of batch.duplicateDetails || []) {
      if (duplicateDetail.manualImportStatus !== 'requested') {
        continue
      }

      if (
        parsedQuery.data.duplicateKind
        && duplicateDetail.duplicateKind !== parsedQuery.data.duplicateKind
      ) {
        continue
      }

      if (dateFrom || dateTo) {
        const requestedAt = duplicateDetail.manualImportRequestedAt

        if (!requestedAt) {
          continue
        }

        if (dateFrom && requestedAt < dateFrom) {
          continue
        }

        if (dateTo && requestedAt > dateTo) {
          continue
        }
      }

      rows.push({
        batchId: batch.batchId,
        sourcePeriod: batch.sourcePeriod,
        uploadedAt: batch.uploadedAt,
        rowNumber: duplicateDetail.rowNumber,
        source: duplicateDetail.source,
        saleOrderId: duplicateDetail.saleOrderId,
        title: duplicateDetail.title,
        quantity: duplicateDetail.quantity,
        extended: duplicateDetail.extended,
        soldAt: duplicateDetail.soldAt,
        duplicateKind: duplicateDetail.duplicateKind,
        matchedRowNumber: duplicateDetail.matchedRowNumber,
        existingBatchId: duplicateDetail.existingBatchId,
        manualImportStatus: duplicateDetail.manualImportStatus,
        manualImportRequestedAt: duplicateDetail.manualImportRequestedAt,
        manualImportRequestedBy: duplicateDetail.manualImportRequestedBy,
        manualImportImportedAt: duplicateDetail.manualImportImportedAt,
        manualImportImportedBy: duplicateDetail.manualImportImportedBy,
        manualImportSaleRecordId: duplicateDetail.manualImportSaleRecordId
      })
    }
  }

  rows.sort((left, right) => {
    const leftTime = left.manualImportRequestedAt
      ? left.manualImportRequestedAt.getTime()
      : 0
    const rightTime = right.manualImportRequestedAt
      ? right.manualImportRequestedAt.getTime()
      : 0

    if (rightTime !== leftTime) {
      return rightTime - leftTime
    }

    if (right.uploadedAt.getTime() !== left.uploadedAt.getTime()) {
      return right.uploadedAt.getTime() - left.uploadedAt.getTime()
    }

    return left.rowNumber - right.rowNumber
  })

  const limitedRows = rows.slice(0, limit)
  const requestedByIds = Array.from(
    new Set(
      limitedRows
        .map(row => row.manualImportRequestedBy)
        .filter((adminId): adminId is string => Boolean(adminId))
    )
  )
  const requestedByMap = await getAdminDisplayNameMap(requestedByIds)

  return {
    rows: limitedRows.map(row => ({
      batchId: row.batchId,
      sourcePeriod: row.sourcePeriod,
      uploadedAt: row.uploadedAt,
      rowNumber: row.rowNumber,
      source: row.source,
      saleOrderId: row.saleOrderId,
      title: row.title,
      quantity: row.quantity,
      extended: row.extended,
      soldAt: row.soldAt,
      duplicateKind: row.duplicateKind,
      matchedRowNumber: row.matchedRowNumber,
      existingBatchId: row.existingBatchId,
      manualImportStatus: row.manualImportStatus,
      manualImportRequestedAt: row.manualImportRequestedAt,
      manualImportRequestedBy:
        row.manualImportRequestedBy
          ? requestedByMap.get(row.manualImportRequestedBy)
          || row.manualImportRequestedBy
          : undefined,
      manualImportImportedAt: row.manualImportImportedAt,
      manualImportImportedBy:
        row.manualImportImportedBy
          ? requestedByMap.get(row.manualImportImportedBy)
          || row.manualImportImportedBy
          : undefined,
      manualImportSaleRecordId: row.manualImportSaleRecordId
    }))
  }
})
