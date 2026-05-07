import { connectToDatabase } from '../../../config/database'
import { requireAdmin } from '../../../utils/adminAuth'
import { SalesImportBatch } from '../../../models/SalesImportBatch'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const batchId = getRouterParam(event, 'batchId')
  if (!batchId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Batch identifier is required'
    })
  }

  const batch = await SalesImportBatch.findOne({ batchId })
  if (!batch) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Sales import batch not found'
    })
  }

  return {
    batch: {
      batchId: batch.batchId,
      sourcePeriod: batch.sourcePeriod,
      uploadedBy: batch.uploadedBy,
      uploadedAt: batch.uploadedAt,
      status: batch.status,
      checksum: batch.checksum,
      summary: {
        total: batch.totalRows,
        accepted: batch.acceptedRows,
        rejected: batch.rejectedRows,
        duplicates: batch.duplicateRows
      },
      errors: batch.errors,
      unmappedSources: batch.unmappedSources
    }
  }
})
