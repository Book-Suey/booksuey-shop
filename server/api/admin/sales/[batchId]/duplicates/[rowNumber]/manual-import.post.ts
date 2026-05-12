import { connectToDatabase } from '../../../../../../config/database'
import { requireAdmin } from '../../../../../../utils/adminAuth'
import { SalesImportBatch } from '../../../../../../models/SalesImportBatch'
import { AuditEvent } from '../../../../../../models/AuditEvent'
import { getAdminDisplayNameMap } from '../../../../../../utils/displayName'

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const batchId = getRouterParam(event, 'batchId')
  const rowNumberParam = getRouterParam(event, 'rowNumber')

  if (!batchId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Batch identifier is required'
    })
  }

  const rowNumber = Number.parseInt(String(rowNumberParam || ''), 10)
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid duplicate row number is required'
    })
  }

  const batch = await SalesImportBatch.findOne({ batchId })
  if (!batch) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Sales import batch not found'
    })
  }

  const duplicateDetail = (batch.duplicateDetails || []).find(
    (detail: { rowNumber: number }) => detail.rowNumber === rowNumber
  )

  if (!duplicateDetail) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Duplicate row not found for this batch'
    })
  }

  if (duplicateDetail.manualImportStatus === 'imported') {
    throw createError({
      statusCode: 409,
      statusMessage: 'This duplicate row has already been imported'
    })
  }

  if (duplicateDetail.manualImportStatus !== 'requested') {
    duplicateDetail.manualImportStatus = 'requested'
    duplicateDetail.manualImportRequestedAt = new Date()
    duplicateDetail.manualImportRequestedBy = adminIdentity.actorId

    await batch.save()

    await AuditEvent.create({
      auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      actorId: adminIdentity.actorId,
      actorRole: adminIdentity.actorRole,
      action: 'sales_duplicate_manual_import_requested',
      entityType: 'SalesImportBatch',
      entityId: batchId,
      before: {
        rowNumber,
        manualImportStatus: 'not_requested'
      },
      after: {
        rowNumber,
        manualImportStatus: 'requested'
      },
      createdAt: new Date()
    })
  }

  const requestedByMap = duplicateDetail.manualImportRequestedBy
    ? await getAdminDisplayNameMap([duplicateDetail.manualImportRequestedBy])
    : new Map<string, string>()

  return {
    duplicateDetail: {
      rowNumber: duplicateDetail.rowNumber,
      manualImportStatus: duplicateDetail.manualImportStatus,
      manualImportRequestedAt: duplicateDetail.manualImportRequestedAt,
      manualImportRequestedBy:
        duplicateDetail.manualImportRequestedBy
          ? requestedByMap.get(duplicateDetail.manualImportRequestedBy)
          || duplicateDetail.manualImportRequestedBy
          : undefined
    }
  }
})
