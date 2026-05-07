import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { BalanceSnapshot } from '../../server/models/BalanceSnapshot'
import { LedgerEntry } from '../../server/models/LedgerEntry'
import { PayoutRequest } from '../../server/models/PayoutRequest'
import { SaleRecord } from '../../server/models/SaleRecord'
import { SalesImportBatch } from '../../server/models/SalesImportBatch'
import { Vendor } from '../../server/models/Vendor'
import { resetRateLimitStore } from '../../server/utils/rateLimit'

let mongoServer: MongoMemoryServer

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
  vi.stubGlobal('getQuery', (event: { query?: Record<string, unknown> }) => event.query ?? {})
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
  resetRateLimitStore()
  await Vendor.deleteMany({})
  await SalesImportBatch.deleteMany({})
  await SaleRecord.deleteMany({})
  await LedgerEntry.deleteMany({})
  await BalanceSnapshot.deleteMany({})
  await PayoutRequest.deleteMany({})
})

async function seedVendorFinancialData(): Promise<void> {
  await Vendor.create({
    vendorId: 'vendor_1',
    legalName: 'Vendor One LLC',
    displayName: 'Vendor One',
    email: 'vendor1@example.com',
    passwordHash: 'hashed-password',
    status: 'active'
  })

  await Vendor.create({
    vendorId: 'vendor_2',
    legalName: 'Vendor Two LLC',
    displayName: 'Vendor Two',
    email: 'vendor2@example.com',
    passwordHash: 'hashed-password',
    status: 'active'
  })

  await SalesImportBatch.create({
    batchId: 'batch_q1',
    sourcePeriod: '2026-Q1',
    uploadedBy: 'admin_1',
    uploadedAt: new Date('2026-04-01T00:00:00.000Z'),
    status: 'completed',
    checksum: 'checksum-1',
    idempotencyKey: '2026-Q1:checksum-1',
    totalRows: 2,
    acceptedRows: 2,
    rejectedRows: 0,
    duplicateRows: 0,
    errors: [],
    unmappedSources: []
  })

  const saleOneId = new mongoose.Types.ObjectId()
  const saleTwoId = new mongoose.Types.ObjectId()
  const saleOtherVendorId = new mongoose.Types.ObjectId()

  await SaleRecord.insertMany([
    {
      _id: saleOneId,
      vendorId: 'vendor_1',
      sourceBatchId: 'batch_q1',
      sourceRowKey: 'row-1',
      soldAt: new Date('2026-05-01T10:00:00.000Z'),
      grossAmount: '15.00',
      commissionAmount: '5.00',
      currency: 'USD',
      title: 'Book One',
      quantity: 1,
      unit: '15.00',
      discount: '0.00',
      extended: '15.00',
      cost: '9.00',
      credit: '7.00',
      saleOrderId: 'SO-1'
    },
    {
      _id: saleTwoId,
      vendorId: 'vendor_1',
      sourceBatchId: 'batch_q1',
      sourceRowKey: 'row-2',
      soldAt: new Date('2026-05-02T11:00:00.000Z'),
      grossAmount: '20.00',
      commissionAmount: '4.00',
      currency: 'USD',
      title: 'Book Two',
      quantity: 2,
      unit: '10.00',
      discount: '0.00',
      extended: '20.00',
      cost: '8.00',
      credit: '6.00',
      saleOrderId: 'SO-2'
    },
    {
      _id: saleOtherVendorId,
      vendorId: 'vendor_2',
      sourceBatchId: 'batch_q1',
      sourceRowKey: 'row-3',
      soldAt: new Date('2026-05-03T12:00:00.000Z'),
      grossAmount: '30.00',
      commissionAmount: '6.00',
      currency: 'USD',
      title: 'Book Three',
      quantity: 1,
      unit: '30.00',
      discount: '0.00',
      extended: '30.00',
      cost: '12.00',
      credit: '10.00',
      saleOrderId: 'SO-3'
    }
  ])

  await LedgerEntry.insertMany([
    {
      entryId: 'ledger_sale_1',
      vendorId: 'vendor_1',
      entryType: 'sale',
      amount: '9.00',
      currency: 'USD',
      referenceType: 'SaleRecord',
      referenceId: String(saleOneId),
      occurredAt: new Date('2026-05-01T10:00:00.000Z')
    },
    {
      entryId: 'ledger_sale_2',
      vendorId: 'vendor_1',
      entryType: 'sale',
      amount: '8.00',
      currency: 'USD',
      referenceType: 'SaleRecord',
      referenceId: String(saleTwoId),
      occurredAt: new Date('2026-05-02T11:00:00.000Z')
    },
    {
      entryId: 'ledger_reservation_1',
      vendorId: 'vendor_1',
      entryType: 'reservation',
      amount: '5.00',
      currency: 'USD',
      referenceType: 'PayoutRequest',
      referenceId: 'payout_existing',
      occurredAt: new Date('2026-05-03T09:00:00.000Z')
    },
    {
      entryId: 'ledger_paid_1',
      vendorId: 'vendor_1',
      entryType: 'paid',
      amount: '5.00',
      currency: 'USD',
      referenceType: 'PayoutRequest',
      referenceId: 'payout_existing',
      occurredAt: new Date('2026-05-04T09:00:00.000Z')
    },
    {
      entryId: 'ledger_other_vendor_sale',
      vendorId: 'vendor_2',
      entryType: 'sale',
      amount: '12.00',
      currency: 'USD',
      referenceType: 'SaleRecord',
      referenceId: String(saleOtherVendorId),
      occurredAt: new Date('2026-05-03T12:00:00.000Z')
    }
  ])

  await PayoutRequest.create({
    payoutRequestId: 'payout_existing',
    vendorId: 'vendor_1',
    amount: '5.00',
    currency: 'USD',
    status: 'paid',
    requestedAt: new Date('2026-05-03T09:00:00.000Z'),
    paidAt: new Date('2026-05-04T09:00:00.000Z')
  })
}

describe('Vendor Financial Endpoints', () => {
  it('returns vendor-scoped sales and supports source period and date filters', async () => {
    await seedVendorFinancialData()

    const { default: getVendorSales } = await import('../../server/api/vendor/sales.get')

    const allSales = await getVendorSales({
      context: { vendorId: 'vendor_1' },
      query: {}
    }) as { sales: Array<{ title: string }> }

    expect(allSales.sales).toHaveLength(2)
    expect(allSales.sales[0].title).toBe('Book Two')
    expect(allSales.sales[1].title).toBe('Book One')

    const filteredSales = await getVendorSales({
      context: { vendorId: 'vendor_1' },
      query: {
        sourcePeriod: '2026-Q1',
        dateFrom: '2026-05-02T00:00:00.000Z'
      }
    }) as { sales: Array<{ title: string }> }

    expect(filteredSales.sales).toHaveLength(1)
    expect(filteredSales.sales[0].title).toBe('Book Two')
  })

  it('returns chronological ledger entries with sale references and balance summary', async () => {
    await seedVendorFinancialData()

    const { default: getVendorLedger } = await import('../../server/api/vendor/ledger.get')
    const { default: getVendorBalance } = await import('../../server/api/vendor/balance.get')

    const ledgerResult = await getVendorLedger({
      context: { vendorId: 'vendor_1' }
    }) as {
      ledgerEntries: Array<{
        entryType: string
        balanceImpact: string
        reference: { sale?: { title: string } }
      }>
    }

    expect(ledgerResult.ledgerEntries).toHaveLength(4)
    expect(ledgerResult.ledgerEntries[0].entryType).toBe('sale')
    expect(ledgerResult.ledgerEntries[0].balanceImpact).toBe('9.00')
    expect(ledgerResult.ledgerEntries[0].reference.sale?.title).toBe('Book One')
    expect(ledgerResult.ledgerEntries[2].entryType).toBe('reservation')
    expect(ledgerResult.ledgerEntries[2].balanceImpact).toBe('-5.00')

    const balanceResult = await getVendorBalance({
      context: { vendorId: 'vendor_1' }
    }) as {
      balance: { pendingAmount: string, availableAmount: string, paidAmount: string }
    }

    expect(balanceResult.balance.pendingAmount).toBe('0.00')
    expect(balanceResult.balance.availableAmount).toBe('12.00')
    expect(balanceResult.balance.paidAmount).toBe('5.00')
  })

  it('lists payout requests by newest first', async () => {
    await seedVendorFinancialData()

    await PayoutRequest.create({
      payoutRequestId: 'payout_requested',
      vendorId: 'vendor_1',
      amount: '3.50',
      currency: 'USD',
      status: 'requested',
      requestedAt: new Date('2026-05-05T09:00:00.000Z'),
      createdAt: new Date('2026-05-05T09:00:00.000Z'),
      updatedAt: new Date('2026-05-05T09:00:00.000Z')
    })

    const { default: getPayoutRequests } = await import('../../server/api/vendor/payout-requests.get')
    const result = await getPayoutRequests({
      context: { vendorId: 'vendor_1' }
    }) as { payoutRequests: Array<{ payoutRequestId: string, status: string }> }

    expect(result.payoutRequests).toHaveLength(2)
    expect(result.payoutRequests[0].payoutRequestId).toBe('payout_requested')
    expect(result.payoutRequests[0].status).toBe('requested')
    expect(result.payoutRequests[1].payoutRequestId).toBe('payout_existing')
  })

  it('creates a payout request, reserves funds, and updates the balance snapshot', async () => {
    await seedVendorFinancialData()

    const { default: createPayoutRequest } = await import('../../server/api/vendor/payout-requests.post')

    const result = await createPayoutRequest({
      context: { vendorId: 'vendor_1' },
      body: { amount: '4.50' }
    }) as {
      payoutRequest: { status: string, amount: string }
      balance: { pendingAmount: string, availableAmount: string }
    }

    expect(result.payoutRequest.status).toBe('requested')
    expect(result.payoutRequest.amount).toBe('4.50')
    expect(result.balance.pendingAmount).toBe('4.50')
    expect(result.balance.availableAmount).toBe('7.50')

    const reservationEntry = await LedgerEntry.findOne({
      vendorId: 'vendor_1',
      referenceType: 'PayoutRequest',
      entryType: 'reservation',
      referenceId: { $ne: 'payout_existing' }
    })

    expect(reservationEntry).toBeDefined()
    expect(reservationEntry?.amount.toString()).toBe('4.50')
  })

  it('rejects invalid, excessive, and rate-limited payout requests', async () => {
    await seedVendorFinancialData()

    const { default: createPayoutRequest } = await import('../../server/api/vendor/payout-requests.post')

    await expect(createPayoutRequest({
      context: { vendorId: 'vendor_1' },
      body: { amount: '0' }
    })).rejects.toMatchObject({
      statusCode: 400
    })

    await expect(createPayoutRequest({
      context: { vendorId: 'vendor_1' },
      body: { amount: '-1.00' }
    })).rejects.toMatchObject({
      statusCode: 400
    })

    await expect(createPayoutRequest({
      context: { vendorId: 'vendor_1' },
      body: { amount: '12.01' }
    })).rejects.toMatchObject({
      statusCode: 409
    })

    for (let index = 0; index < 10; index += 1) {
      await createPayoutRequest({
        context: { vendorId: 'vendor_2' },
        body: { amount: '1.00' }
      })
    }

    await expect(createPayoutRequest({
      context: { vendorId: 'vendor_2' },
      body: { amount: '1.00' }
    })).rejects.toMatchObject({
      statusCode: 429
    })
  })
})
