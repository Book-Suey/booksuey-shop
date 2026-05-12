import { connectToDatabase } from '../../../config/database'
import { requireAdmin } from '../../../utils/adminAuth'
import { SalesImportBatch } from '../../../models/SalesImportBatch'
import { getAdminDisplayNameMap } from '../../../utils/displayName'

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

  const adminIds = [batch.uploadedBy]

  for (const duplicateDetail of batch.duplicateDetails || []) {
    if (duplicateDetail.manualImportRequestedBy) {
      adminIds.push(duplicateDetail.manualImportRequestedBy)
    }
  }

  const uploadedByMap = await getAdminDisplayNameMap(adminIds)

  return {
    batch: {
      batchId: batch.batchId,
      sourcePeriod: batch.sourcePeriod,
      uploadedBy: uploadedByMap.get(batch.uploadedBy) || batch.uploadedBy,
      uploadedAt: batch.uploadedAt,
      status: batch.status,
      checksum: batch.checksum,
      summary: {
        total: batch.totalRows,
        accepted: batch.acceptedRows,
        rejected: batch.rejectedRows,
        nonVendorRejected: batch.nonVendorRejectedRows,
        duplicates: batch.duplicateRows
      },
      duplicateDetails: (batch.duplicateDetails || []).map((duplicateDetail: {
        rowNumber: number
        source: string
        saleOrderId: string
        title: string
        quantity: number
        unit: string
        discount: string
        extended: string
        cost: string
        credit: string
        soldAt: Date
        sourceRowKey: string
        duplicateKind: 'within-upload' | 'existing-sale'
        matchedRowNumber?: number
        existingBatchId?: string
        manualImportStatus: 'not_requested' | 'requested' | 'imported'
        manualImportRequestedAt?: Date
        manualImportRequestedBy?: string
        manualImportImportedAt?: Date
        manualImportImportedBy?: string
        manualImportSaleRecordId?: string
      }) => ({
        rowNumber: duplicateDetail.rowNumber,
        source: duplicateDetail.source,
        saleOrderId: duplicateDetail.saleOrderId,
        title: duplicateDetail.title,
        quantity: duplicateDetail.quantity,
        unit: duplicateDetail.unit,
        discount: duplicateDetail.discount,
        extended: duplicateDetail.extended,
        cost: duplicateDetail.cost,
        credit: duplicateDetail.credit,
        soldAt: duplicateDetail.soldAt,
        sourceRowKey: duplicateDetail.sourceRowKey,
        duplicateKind: duplicateDetail.duplicateKind,
        matchedRowNumber: duplicateDetail.matchedRowNumber,
        existingBatchId: duplicateDetail.existingBatchId,
        manualImportStatus: duplicateDetail.manualImportStatus,
        manualImportRequestedAt: duplicateDetail.manualImportRequestedAt,
        manualImportRequestedBy:
          duplicateDetail.manualImportRequestedBy
            ? uploadedByMap.get(duplicateDetail.manualImportRequestedBy)
            || duplicateDetail.manualImportRequestedBy
            : undefined,
        manualImportImportedAt: duplicateDetail.manualImportImportedAt,
        manualImportImportedBy:
          duplicateDetail.manualImportImportedBy
            ? uploadedByMap.get(duplicateDetail.manualImportImportedBy)
            || duplicateDetail.manualImportImportedBy
            : undefined,
        manualImportSaleRecordId: duplicateDetail.manualImportSaleRecordId
      })),
      errors: batch.errors,
      unmappedSources: batch.unmappedSources,
      nonVendorSources: batch.nonVendorSources
    }
  }
})
