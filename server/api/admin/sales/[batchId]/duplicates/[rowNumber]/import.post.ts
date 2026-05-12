import crypto from 'crypto'
import { connectToDatabase } from '../../../../../../config/database'
import { requireAdmin } from '../../../../../../utils/adminAuth'
import { SalesImportBatch } from '../../../../../../models/SalesImportBatch'
import { ApprovedVendor } from '../../../../../../models/ApprovedVendor'
import { Vendor } from '../../../../../../models/Vendor'
import { AuditEvent } from '../../../../../../models/AuditEvent'
import { ensureSaleRecordIndexes, SaleRecord } from '../../../../../../models/SaleRecord'
import { LedgerEntry } from '../../../../../../models/LedgerEntry'
import {
  normalizeApprovedVendorSource,
  normalizeImportSource,
  computeLedgerAmount
} from '../../../../../../utils/salesImport'
import { recomputeBalanceSnapshotsForVendors } from '../../../../../../utils/balance'

function buildManualSourceRowKey(input: {
  baseSourceRowKey: string
  batchId: string
  rowNumber: number
}): string {
  return `${input.baseSourceRowKey}::manual-import::${input.batchId}::${input.rowNumber}`
}

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()
  await ensureSaleRecordIndexes()

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
    return {
      imported: false,
      saleRecordId: duplicateDetail.manualImportSaleRecordId,
      status: 'already_imported'
    }
  }

  if (duplicateDetail.manualImportStatus !== 'requested') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Duplicate row must be requested for manual import first'
    })
  }

  const approvedVendors = await ApprovedVendor.find({}, {
    basilId: 1,
    firstName: 1,
    lastName: 1,
    _id: 0
  })
  const sourceToApprovedVendor = new Map<string, string>()
  approvedVendors.forEach((approvedVendor: { firstName: string, lastName: string, basilId: string }) => {
    sourceToApprovedVendor.set(
      normalizeApprovedVendorSource(approvedVendor.firstName, approvedVendor.lastName),
      approvedVendor.basilId
    )
  })

  const approvedVendorId = sourceToApprovedVendor.get(
    normalizeImportSource(duplicateDetail.source)
  )

  if (!approvedVendorId) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Unable to import this row because Source is not mapped to an approved vendor'
    })
  }

  const vendor = await Vendor.findOne({ approvedVendorId }, { vendorId: 1, _id: 0 })

  const existingSourceRow = await SaleRecord.findOne(
    { sourceRowKey: duplicateDetail.sourceRowKey },
    { _id: 1 }
  )
  const sourceRowKey = existingSourceRow
    ? buildManualSourceRowKey({
        baseSourceRowKey: duplicateDetail.sourceRowKey,
        batchId,
        rowNumber
      })
    : duplicateDetail.sourceRowKey

  const saleRecord = await SaleRecord.create({
    vendorId: vendor?.vendorId,
    approvedVendorId,
    sourceBatchId: batchId,
    sourceRowKey,
    soldAt: duplicateDetail.soldAt,
    grossAmount: duplicateDetail.extended,
    commissionAmount: computeLedgerAmount(duplicateDetail.cost, duplicateDetail.credit),
    currency: 'USD',
    title: duplicateDetail.title,
    quantity: duplicateDetail.quantity,
    unit: duplicateDetail.unit,
    discount: duplicateDetail.discount,
    extended: duplicateDetail.extended,
    cost: duplicateDetail.cost,
    credit: duplicateDetail.credit,
    saleOrderId: duplicateDetail.saleOrderId
  })

  await LedgerEntry.create({
    entryId: `ledger_${crypto.randomBytes(8).toString('hex')}`,
    vendorId: vendor?.vendorId,
    approvedVendorId,
    entryType: 'sale',
    amount: computeLedgerAmount(duplicateDetail.cost, duplicateDetail.credit),
    currency: 'USD',
    referenceType: 'SaleRecord',
    referenceId: String(saleRecord._id),
    occurredAt: duplicateDetail.soldAt
  })

  if (vendor?.vendorId) {
    await recomputeBalanceSnapshotsForVendors([vendor.vendorId])
  }

  duplicateDetail.manualImportStatus = 'imported'
  duplicateDetail.manualImportImportedAt = new Date()
  duplicateDetail.manualImportImportedBy = adminIdentity.actorId
  duplicateDetail.manualImportSaleRecordId = String(saleRecord._id)

  await batch.save()

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'sales_duplicate_imported',
    entityType: 'SalesImportBatch',
    entityId: batchId,
    before: {
      rowNumber,
      manualImportStatus: 'requested'
    },
    after: {
      rowNumber,
      manualImportStatus: 'imported',
      saleRecordId: String(saleRecord._id)
    },
    createdAt: new Date()
  })

  return {
    imported: true,
    saleRecordId: String(saleRecord._id),
    status: 'imported'
  }
})
