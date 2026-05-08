import crypto from 'crypto'
import type { H3Event } from 'h3'
import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { requireAdmin } from '../../../utils/adminAuth'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { Vendor } from '../../../models/Vendor'
import { SalesImportBatch } from '../../../models/SalesImportBatch'
import { ensureSaleRecordIndexes, SaleRecord } from '../../../models/SaleRecord'
import { LedgerEntry } from '../../../models/LedgerEntry'
import { AuditEvent } from '../../../models/AuditEvent'
import { VerifiedNonVendorSource } from '../../../models/VerifiedNonVendorSource'
import { recomputeBalanceSnapshotsForVendors } from '../../../utils/balance'
import {
  computeLedgerAmount,
  normalizeApprovedVendorSource,
  normalizeImportSource,
  parseAndValidateSalesCsv
} from '../../../utils/salesImport'

const importSchema = z.object({
  sourcePeriod: z.string().min(1),
  csvContent: z.string().min(1)
})

async function readImportRequest(event: H3Event): Promise<{ sourcePeriod: string, csvContent: string }> {
  const contentType = getHeader(event, 'content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const parts = await readMultipartFormData(event)
    const sourcePeriodPart = parts?.find(part => part.name === 'sourcePeriod')
    const filePart = parts?.find(part => part.name === 'file')
    const csvContentPart = parts?.find(part => part.name === 'csvContent')

    const sourcePeriod = sourcePeriodPart?.data ? Buffer.from(sourcePeriodPart.data).toString('utf8').trim() : ''
    const csvContent = filePart?.data
      ? Buffer.from(filePart.data).toString('utf8')
      : csvContentPart?.data
        ? Buffer.from(csvContentPart.data).toString('utf8')
        : ''

    const parsed = importSchema.safeParse({ sourcePeriod, csvContent })
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'IMPORT_INVALID_FILE_FORMAT: Invalid multipart payload'
      })
    }

    return parsed.data
  }

  const body = await readBody(event)
  const parsed = importSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'IMPORT_INVALID_FILE_FORMAT: Invalid request body'
    })
  }

  return parsed.data
}

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()
  await ensureSaleRecordIndexes()

  const { sourcePeriod, csvContent } = await readImportRequest(event)
  const checksum = crypto.createHash('sha256').update(csvContent).digest('hex')
  const idempotencyKey = `${sourcePeriod}:${checksum}`

  const existingBatch = await SalesImportBatch.findOne({ idempotencyKey })
  if (existingBatch) {
    throw createError({
      statusCode: 409,
      statusMessage: 'IMPORT_DUPLICATE_BATCH: Batch already imported'
    })
  }

  const parsedCsv = parseAndValidateSalesCsv(csvContent)

  const approvedVendors = await ApprovedVendor.find({})
  const sourceToApprovedVendor = new Map<string, string>()
  approvedVendors.forEach((approvedVendor: { firstName: string, lastName: string, basilId: string }) => {
    sourceToApprovedVendor.set(
      normalizeApprovedVendorSource(approvedVendor.firstName, approvedVendor.lastName),
      approvedVendor.basilId
    )
  })

  const vendors = await Vendor.find({ approvedVendorId: { $exists: true } })
  const approvedVendorToVendor = new Map<string, string>()
  vendors.forEach((vendor: { approvedVendorId?: string, vendorId: string }) => {
    if (vendor.approvedVendorId) {
      approvedVendorToVendor.set(vendor.approvedVendorId, vendor.vendorId)
    }
  })

  const verifiedNonVendorSources = await VerifiedNonVendorSource.find({}, { normalizedSource: 1, _id: 0 })
  const nonVendorSourceSet = new Set(
    verifiedNonVendorSources.map((record: { normalizedSource: string }) => record.normalizedSource)
  )

  const existingRows = await SaleRecord.find(
    { sourceRowKey: { $in: parsedCsv.rows.map(row => row.sourceRowKey) } },
    { sourceRowKey: 1 }
  )
  const existingRowKeys = new Set(existingRows.map((row: { sourceRowKey: string }) => row.sourceRowKey))

  const batchId = `batch_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const rowErrors = [...parsedCsv.rowErrors]
  const unmappedSources = new Set<string>()
  const nonVendorSources = new Set<string>()
  let nonVendorRejectedRows = 0
  let duplicateRows = parsedCsv.duplicateRows

  const acceptedRows = [] as Array<{
    vendorId: string
    sourceRowKey: string
    saleOrderId: string
    soldAt: Date
    title: string
    quantity: number
    unit: string
    discount: string
    extended: string
    grossAmount: string
    commissionAmount: string
    cost: string
    credit: string
  }>

  for (const row of parsedCsv.rows) {
    if (existingRowKeys.has(row.sourceRowKey)) {
      duplicateRows += 1
      continue
    }

    const normalizedSource = normalizeImportSource(row.source)

    if (nonVendorSourceSet.has(normalizedSource)) {
      nonVendorRejectedRows += 1
      nonVendorSources.add(row.source)
      continue
    }

    const approvedVendorId = sourceToApprovedVendor.get(normalizedSource)
    const vendorId = approvedVendorId ? approvedVendorToVendor.get(approvedVendorId) : undefined

    if (!vendorId) {
      unmappedSources.add(row.source)
      rowErrors.push({
        code: 'IMPORT_UNMAPPED_SOURCE',
        rowNumber: row.rowNumber,
        reason: `Unmapped Source: ${row.source}`,
        hint: 'Ensure Source maps to ApprovedVendor and linked Vendor account'
      })
      continue
    }

    acceptedRows.push({
      vendorId,
      sourceRowKey: row.sourceRowKey,
      saleOrderId: row.saleOrderId,
      soldAt: row.soldAt,
      title: row.title,
      quantity: row.quantity,
      unit: row.unit,
      discount: row.discount,
      extended: row.extended,
      grossAmount: row.grossAmount,
      commissionAmount: row.commissionAmount,
      cost: row.cost,
      credit: row.credit
    })
  }

  if (acceptedRows.length > 0) {
    const createdSaleRecords = await SaleRecord.insertMany(acceptedRows.map(row => ({
      vendorId: row.vendorId,
      sourceBatchId: batchId,
      sourceRowKey: row.sourceRowKey,
      soldAt: row.soldAt,
      grossAmount: row.grossAmount,
      commissionAmount: row.commissionAmount,
      currency: 'USD',
      title: row.title,
      quantity: row.quantity,
      unit: row.unit,
      discount: row.discount,
      extended: row.extended,
      cost: row.cost,
      credit: row.credit,
      saleOrderId: row.saleOrderId
    })))

    await LedgerEntry.insertMany(createdSaleRecords.map((saleRecord: {
      _id: string
      vendorId: string
      soldAt: Date
      cost: { toString(): string }
      credit: { toString(): string }
    }) => ({
      entryId: `ledger_${crypto.randomBytes(8).toString('hex')}`,
      vendorId: saleRecord.vendorId,
      entryType: 'sale',
      amount: computeLedgerAmount(saleRecord.cost.toString(), saleRecord.credit.toString()),
      currency: 'USD',
      referenceType: 'SaleRecord',
      referenceId: String(saleRecord._id),
      occurredAt: saleRecord.soldAt
    })))

    await recomputeBalanceSnapshotsForVendors(createdSaleRecords.map((saleRecord: { vendorId: string }) => saleRecord.vendorId))
  }

  await SalesImportBatch.create({
    batchId,
    sourcePeriod,
    uploadedBy: adminIdentity.actorId,
    uploadedAt: new Date(),
    status: 'completed',
    checksum,
    idempotencyKey,
    totalRows: parsedCsv.totalRows,
    acceptedRows: acceptedRows.length,
    rejectedRows: rowErrors.length + nonVendorRejectedRows,
    nonVendorRejectedRows,
    duplicateRows,
    errors: rowErrors,
    unmappedSources: Array.from(unmappedSources),
    nonVendorSources: Array.from(nonVendorSources)
  })

  await AuditEvent.create({
    auditEventId: `audit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    actorId: adminIdentity.actorId,
    actorRole: adminIdentity.actorRole,
    action: 'sales_imported',
    entityType: 'SalesImportBatch',
    entityId: batchId,
    after: {
      totalRows: parsedCsv.totalRows,
      accepted: acceptedRows.length,
      rejected: rowErrors.length + nonVendorRejectedRows,
      nonVendorRejected: nonVendorRejectedRows,
      duplicates: duplicateRows
    },
    createdAt: new Date()
  })

  return {
    batchId,
    summary: {
      total: parsedCsv.totalRows,
      accepted: acceptedRows.length,
      rejected: rowErrors.length + nonVendorRejectedRows,
      nonVendorRejected: nonVendorRejectedRows,
      duplicates: duplicateRows
    },
    errors: rowErrors,
    unmappedSources: Array.from(unmappedSources),
    nonVendorSources: Array.from(nonVendorSources)
  }
})
