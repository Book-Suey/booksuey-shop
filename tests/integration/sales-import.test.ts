import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { generateToken } from '../../server/utils/auth'
import { ApprovedVendor } from '../../server/models/ApprovedVendor'
import { Vendor } from '../../server/models/Vendor'
import { SalesImportBatch } from '../../server/models/SalesImportBatch'
import { SaleRecord } from '../../server/models/SaleRecord'
import { LedgerEntry } from '../../server/models/LedgerEntry'
import { BalanceSnapshot } from '../../server/models/BalanceSnapshot'
import { AuditEvent } from '../../server/models/AuditEvent'
import { VerifiedNonVendorSource } from '../../server/models/VerifiedNonVendorSource'

let mongoServer: MongoMemoryServer
let multipartParts: Array<{ name?: string, data?: Uint8Array }> | undefined

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-for-integration-tests'
  process.env.JWT_EXPIRES_IN = '7d'
  process.env.BCRYPT_COST_FACTOR = '12'

  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  process.env.MONGODB_URI = uri
  await mongoose.connect(uri)

  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body ?? {})
  vi.stubGlobal('readMultipartFormData', async () => multipartParts)
  vi.stubGlobal('getHeader', (event: { headers?: Record<string, string | undefined> }, key: string) => event.headers?.[key])
  vi.stubGlobal('getRouterParam', (event: { params?: Record<string, string> }, key: string) => event.params?.[key])
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => {
    const error = new Error(input.statusMessage) as Error & { statusCode: number, statusMessage: string }
    error.statusCode = input.statusCode
    error.statusMessage = input.statusMessage
    return error
  })
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  vi.resetModules()
  await ApprovedVendor.deleteMany({})
  await Vendor.deleteMany({})
  await SalesImportBatch.deleteMany({})
  await SaleRecord.deleteMany({})
  await LedgerEntry.deleteMany({})
  await BalanceSnapshot.deleteMany({})
  await AuditEvent.deleteMany({})
  await VerifiedNonVendorSource.deleteMany({})
  multipartParts = undefined
})

function adminHeaders(): Record<string, string> {
  const { token } = generateToken({
    adminId: 'admin_sales_import',
    email: 'admin@example.com',
    role: 'admin'
  })

  return {
    authorization: `Bearer ${token}`
  }
}

const csvHeader = 'Date,Time,Source,Extended,Discount,Cost,Credit,Title,Quantity,Unit,Sale/Order ID\n'

describe('Admin Sales Import Endpoint', () => {
  it('imports valid CSV rows, creates sale records and ledger entries', async () => {
    await ApprovedVendor.create({
      basilId: 'BASIL-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com'
    })

    await Vendor.create({
      vendorId: 'vendor_1',
      legalName: 'Jane Doe LLC',
      displayName: 'Jane Doe',
      email: 'vendor-jane@example.com',
      passwordHash: 'hashed-password',
      status: 'active',
      approvedVendorId: 'BASIL-1'
    })

    const csvContent = `${csvHeader}2026-05-01,10:15 AM,Jane Doe,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-100\n`

    const { default: importSales } = await import('../../server/api/admin/sales/imports.post')

    const result = await importSales({
      headers: adminHeaders(),
      body: {
        sourcePeriod: '2026-Q2',
        csvContent
      }
    }) as { summary: { total: number, accepted: number, rejected: number, duplicates: number }, batchId: string }

    expect(result.summary.total).toBe(1)
    expect(result.summary.accepted).toBe(1)
    expect(result.summary.rejected).toBe(0)
    expect(result.summary.duplicates).toBe(0)

    const saleRecords = await SaleRecord.find({ sourceBatchId: result.batchId })
    expect(saleRecords).toHaveLength(1)
    expect(saleRecords[0].saleOrderId).toBe('SO-100')
    expect(saleRecords[0].grossAmount.toString()).toBe('12.50')
    expect(saleRecords[0].commissionAmount.toString()).toBe('8.00')
    expect(saleRecords[0].unit.toString()).toBe('12.50')
    expect(saleRecords[0].cost.toString()).toBe('8.00')
    expect(saleRecords[0].credit.toString()).toBe('7.00')

    const ledgerEntries = await LedgerEntry.find({ referenceId: String(saleRecords[0]._id) })
    expect(ledgerEntries).toHaveLength(1)
    expect(ledgerEntries[0].entryType).toBe('sale')
    expect(ledgerEntries[0].amount.toString()).toBe('8.00')

    const balanceSnapshot = await BalanceSnapshot.findOne({ vendorId: 'vendor_1' })
    expect(balanceSnapshot).toBeDefined()
    expect(balanceSnapshot?.availableAmount.toString()).toBe('8.00')
    expect(balanceSnapshot?.paidAmount.toString()).toBe('0.00')
  })

  it('accepts multipart uploads and returns batch details with structured errors', async () => {
    const csvContent = `${csvHeader}05/01/2026,10:15 AM,Unknown Vendor,12.50,2.50,8.00,7.00,Book A,1,12.50,SO-300\n`

    multipartParts = [
      { name: 'sourcePeriod', data: Buffer.from('2026-Q2') },
      { name: 'file', data: Buffer.from(csvContent) }
    ]

    const { default: importSales } = await import('../../server/api/admin/sales/imports.post')
    const { default: getBatch } = await import('../../server/api/admin/sales/[batchId].get')

    const result = await importSales({
      headers: {
        ...adminHeaders(),
        'content-type': 'multipart/form-data; boundary=test-boundary'
      }
    }) as { batchId: string, errors: Array<{ code: string, rowNumber: number }> }

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('IMPORT_UNMAPPED_SOURCE')
    expect(result.errors[0].rowNumber).toBe(2)

    const batchDetail = await getBatch({
      headers: adminHeaders(),
      params: { batchId: result.batchId }
    }) as { batch: { summary: { total: number, accepted: number, rejected: number }, errors: Array<{ code: string, rowNumber: number }> } }

    expect(batchDetail.batch.summary.total).toBe(1)
    expect(batchDetail.batch.summary.accepted).toBe(0)
    expect(batchDetail.batch.summary.rejected).toBe(1)
    expect(batchDetail.batch.errors[0].code).toBe('IMPORT_UNMAPPED_SOURCE')
  })

  it('rejects duplicate batch imports by idempotency key', async () => {
    await ApprovedVendor.create({
      basilId: 'BASIL-2',
      firstName: 'John',
      lastName: 'Smith',
      email: 'john@example.com'
    })

    await Vendor.create({
      vendorId: 'vendor_2',
      legalName: 'John Smith LLC',
      displayName: 'John Smith',
      email: 'vendor-john@example.com',
      passwordHash: 'hashed-password',
      status: 'active',
      approvedVendorId: 'BASIL-2'
    })

    const csvContent = `${csvHeader}05/01/2026,10:15 AM,John Smith,12.50,2.50,8.00,7.00,Book A,1,12.50,SO-200\n`

    const { default: importSales } = await import('../../server/api/admin/sales/imports.post')

    await importSales({
      headers: adminHeaders(),
      body: {
        sourcePeriod: '2026-Q2',
        csvContent
      }
    })

    await expect(importSales({
      headers: adminHeaders(),
      body: {
        sourcePeriod: '2026-Q2',
        csvContent
      }
    })).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('reconciles stale legacy saleId indexes before inserting sale records', async () => {
    await ApprovedVendor.create({
      basilId: 'BASIL-3',
      firstName: 'Legacy',
      lastName: 'Vendor',
      email: 'legacy@example.com'
    })

    await Vendor.create({
      vendorId: 'vendor_3',
      legalName: 'Legacy Vendor LLC',
      displayName: 'Legacy Vendor',
      email: 'vendor-legacy@example.com',
      passwordHash: 'hashed-password',
      status: 'active',
      approvedVendorId: 'BASIL-3'
    })

    await SaleRecord.collection.createIndex({ saleId: 1 }, { unique: true })

    const csvContent = `${csvHeader}2026-05-01,2:28 PM,Legacy Vendor,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-500\n`

    const { default: importSales } = await import('../../server/api/admin/sales/imports.post')

    const result = await importSales({
      headers: adminHeaders(),
      body: {
        sourcePeriod: '2026-Q2',
        csvContent
      }
    }) as { summary: { accepted: number }, batchId: string }

    expect(result.summary.accepted).toBe(1)

    const saleRecords = await SaleRecord.find({ sourceBatchId: result.batchId })
    expect(saleRecords).toHaveLength(1)

    const indexes = await SaleRecord.collection.indexes()
    expect(indexes.some(index => index.name === 'saleId_1')).toBe(false)
    expect(indexes.some(index => index.name === 'sourceRowKey_1')).toBe(true)
  })

  it('imports distinct line items that share the same sale order id', async () => {
    await ApprovedVendor.create({
      basilId: 'BASIL-4',
      firstName: 'Shared',
      lastName: 'Order',
      email: 'shared-order@example.com'
    })

    await Vendor.create({
      vendorId: 'vendor_4',
      legalName: 'Shared Order LLC',
      displayName: 'Shared Order',
      email: 'vendor-shared@example.com',
      passwordHash: 'hashed-password',
      status: 'active',
      approvedVendorId: 'BASIL-4'
    })

    const csvContent = [
      'Date,Time,Source,Extended,Discount,Cost,Credit,Title,Quantity,Unit,Sale/Order ID,ISBN,Barcode,Register',
      '2026-05-01,2:28 PM,Shared Order,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-900,9780000000001,111,Drawer1',
      '2026-05-01,2:28 PM,Shared Order,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-900,9780000000002,222,Drawer1'
    ].join('\n') + '\n'

    const { default: importSales } = await import('../../server/api/admin/sales/imports.post')

    const result = await importSales({
      headers: adminHeaders(),
      body: {
        sourcePeriod: '2026-Q2',
        csvContent
      }
    }) as { summary: { total: number, accepted: number, duplicates: number }, batchId: string }

    expect(result.summary.total).toBe(2)
    expect(result.summary.accepted).toBe(2)
    expect(result.summary.duplicates).toBe(0)

    const saleRecords = await SaleRecord.find({ sourceBatchId: result.batchId }).sort({ sourceRowKey: 1 })
    expect(saleRecords).toHaveLength(2)
    expect(saleRecords[0].sourceRowKey.toString()).not.toBe(saleRecords[1].sourceRowKey.toString())
    expect(saleRecords[0].saleOrderId).toBe('SO-900')
    expect(saleRecords[1].saleOrderId).toBe('SO-900')
  })

  it('rejects verified non-vendor rows without reporting them as import errors', async () => {
    await VerifiedNonVendorSource.create({
      sourceName: 'Customer Credit',
      normalizedSource: 'customer credit'
    })

    const csvContent = `${csvHeader}2026-05-01,10:15 AM,Customer Credit,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-777\n`

    const { default: importSales } = await import('../../server/api/admin/sales/imports.post')
    const { default: getBatch } = await import('../../server/api/admin/sales/[batchId].get')

    const result = await importSales({
      headers: adminHeaders(),
      body: {
        sourcePeriod: '2026-Q2',
        csvContent
      }
    }) as {
      batchId: string
      summary: { total: number, accepted: number, rejected: number, nonVendorRejected: number }
      errors: Array<{ code: string }>
      nonVendorSources: string[]
    }

    expect(result.summary.total).toBe(1)
    expect(result.summary.accepted).toBe(0)
    expect(result.summary.rejected).toBe(1)
    expect(result.summary.nonVendorRejected).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(result.nonVendorSources).toContain('Customer Credit')

    const saleRecords = await SaleRecord.find({ sourceBatchId: result.batchId })
    expect(saleRecords).toHaveLength(0)

    const batchDetail = await getBatch({
      headers: adminHeaders(),
      params: { batchId: result.batchId }
    }) as {
      batch: {
        summary: { rejected: number, nonVendorRejected: number }
        errors: Array<{ code: string }>
        nonVendorSources: string[]
      }
    }

    expect(batchDetail.batch.summary.rejected).toBe(1)
    expect(batchDetail.batch.summary.nonVendorRejected).toBe(1)
    expect(batchDetail.batch.errors).toHaveLength(0)
    expect(batchDetail.batch.nonVendorSources).toContain('Customer Credit')
  })
})
