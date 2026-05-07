import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { AuditEvent } from '../../server/models/AuditEvent'
import { BalanceSnapshot } from '../../server/models/BalanceSnapshot'
import { LedgerEntry } from '../../server/models/LedgerEntry'
import { PaymentDisbursement } from '../../server/models/PaymentDisbursement'
import { PayoutRequest } from '../../server/models/PayoutRequest'
import { SalesImportBatch } from '../../server/models/SalesImportBatch'
import { Vendor } from '../../server/models/Vendor'
import { generateToken, hashPassword } from '../../server/utils/auth'

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
  vi.stubGlobal('getRouterParam', (event: { params?: Record<string, string> }, key: string) => event.params?.[key])
  vi.stubGlobal('getHeader', (event: { headers?: Record<string, string | undefined> }, key: string) => event.headers?.[key])
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
  await Vendor.deleteMany({})
  await AuditEvent.deleteMany({})
  await SalesImportBatch.deleteMany({})
  await PayoutRequest.deleteMany({})
  await PaymentDisbursement.deleteMany({})
  await LedgerEntry.deleteMany({})
  await BalanceSnapshot.deleteMany({})
})

function adminHeaders(): Record<string, string> {
  const { token } = generateToken({
    adminId: 'admin_ops_1',
    email: 'admin-ops@example.com',
    role: 'admin'
  })

  return {
    authorization: `Bearer ${token}`
  }
}

describe('Admin Operations Visibility Endpoints', () => {
  it('lists audit history and supports action/entity filters', async () => {
    await AuditEvent.insertMany([
      {
        auditEventId: 'audit_ops_1',
        actorId: 'admin_ops_1',
        actorRole: 'admin',
        action: 'payout_approved',
        entityType: 'PayoutRequest',
        entityId: 'payout_1',
        createdAt: new Date('2026-05-06T09:00:00.000Z')
      },
      {
        auditEventId: 'audit_ops_2',
        actorId: 'admin_ops_1',
        actorRole: 'admin',
        action: 'sales_imported',
        entityType: 'SalesImportBatch',
        entityId: 'batch_1',
        createdAt: new Date('2026-05-06T10:00:00.000Z')
      }
    ])

    const { default: getAuditHistory } = await import('../../server/api/admin/audit.get')

    const allEventsResult = await getAuditHistory({
      headers: adminHeaders(),
      query: {}
    }) as { auditEvents: Array<{ auditEventId: string }> }

    expect(allEventsResult.auditEvents).toHaveLength(2)
    expect(allEventsResult.auditEvents[0].auditEventId).toBe('audit_ops_2')

    const filteredResult = await getAuditHistory({
      headers: adminHeaders(),
      query: {
        action: 'payout_approved',
        entityType: 'PayoutRequest'
      }
    }) as { auditEvents: Array<{ action: string, entityType: string }> }

    expect(filteredResult.auditEvents).toHaveLength(1)
    expect(filteredResult.auditEvents[0].action).toBe('payout_approved')
    expect(filteredResult.auditEvents[0].entityType).toBe('PayoutRequest')
  })

  it('lists import status and includes failed import error details', async () => {
    await SalesImportBatch.insertMany([
      {
        batchId: 'batch_ops_completed',
        sourcePeriod: '2026-Q1',
        uploadedBy: 'admin_ops_1',
        uploadedAt: new Date('2026-05-05T09:00:00.000Z'),
        status: 'completed',
        checksum: 'checksum-completed',
        idempotencyKey: '2026-Q1:checksum-completed',
        totalRows: 10,
        acceptedRows: 10,
        rejectedRows: 0,
        duplicateRows: 0,
        errors: [],
        unmappedSources: []
      },
      {
        batchId: 'batch_ops_failed',
        sourcePeriod: '2026-Q2',
        uploadedBy: 'admin_ops_1',
        uploadedAt: new Date('2026-05-06T09:00:00.000Z'),
        status: 'failed',
        checksum: 'checksum-failed',
        idempotencyKey: '2026-Q2:checksum-failed',
        totalRows: 5,
        acceptedRows: 3,
        rejectedRows: 2,
        duplicateRows: 0,
        errors: [
          {
            code: 'IMPORT_UNMAPPED_SOURCE',
            rowNumber: 3,
            reason: 'Unmapped Source: Jane Doe',
            hint: 'Ensure Source maps to ApprovedVendor and linked Vendor account'
          }
        ],
        unmappedSources: ['Jane Doe']
      }
    ])

    const { default: getImportStatuses } = await import('../../server/api/admin/imports.get')

    const result = await getImportStatuses({
      headers: adminHeaders(),
      query: {
        status: 'failed'
      }
    }) as {
      imports: Array<{
        batchId: string
        status: string
        errors: Array<{ code: string }>
        unmappedSources: string[]
      }>
    }

    expect(result.imports).toHaveLength(1)
    expect(result.imports[0].batchId).toBe('batch_ops_failed')
    expect(result.imports[0].status).toBe('failed')
    expect(result.imports[0].errors[0].code).toBe('IMPORT_UNMAPPED_SOURCE')
    expect(result.imports[0].unmappedSources).toContain('Jane Doe')
  })

  it('shows failed payout reconciliation details', async () => {
    await Vendor.create({
      vendorId: 'vendor_ops_1',
      legalName: 'Vendor Ops LLC',
      displayName: 'Vendor Ops',
      email: 'vendor-ops@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    await PayoutRequest.create({
      payoutRequestId: 'payout_ops_failed',
      vendorId: 'vendor_ops_1',
      amount: '5.00',
      currency: 'USD',
      status: 'failed',
      requestedAt: new Date('2026-05-05T09:00:00.000Z'),
      failedAt: new Date('2026-05-06T10:00:00.000Z')
    })

    await PaymentDisbursement.create({
      disbursementId: 'disb_ops_failed',
      payoutRequestId: 'payout_ops_failed',
      idempotencyKey: 'idem-ops-failed',
      methodType: 'venmo',
      providerReferenceId: 'venmo-ops-ref',
      amount: '5.00',
      currency: 'USD',
      status: 'failed',
      disbursedAt: new Date('2026-05-06T10:00:00.000Z'),
      failureReason: 'Provider timeout'
    })

    await LedgerEntry.create({
      entryId: 'ledger_ops_release_failed',
      vendorId: 'vendor_ops_1',
      entryType: 'release',
      amount: '5.00',
      currency: 'USD',
      referenceType: 'PayoutRequest',
      referenceId: 'payout_ops_failed',
      occurredAt: new Date('2026-05-06T10:01:00.000Z')
    })

    await BalanceSnapshot.create({
      vendorId: 'vendor_ops_1',
      pendingAmount: '0.00',
      availableAmount: '12.50',
      paidAmount: '2.00',
      asOf: new Date('2026-05-06T10:02:00.000Z')
    })

    const { default: getPayoutFailures } = await import('../../server/api/admin/payout-failures.get')

    const result = await getPayoutFailures({
      headers: adminHeaders(),
      query: {}
    }) as {
      payoutFailures: Array<{
        payoutRequestId: string
        disbursement?: { status: string, failureReason?: string }
        reconciliation: { releasedAmount: string, restored: boolean }
        balanceSnapshot?: { availableAmount: string }
      }>
    }

    expect(result.payoutFailures).toHaveLength(1)
    expect(result.payoutFailures[0].payoutRequestId).toBe('payout_ops_failed')
    expect(result.payoutFailures[0].disbursement?.status).toBe('failed')
    expect(result.payoutFailures[0].disbursement?.failureReason).toBe('Provider timeout')
    expect(result.payoutFailures[0].reconciliation.releasedAmount).toBe('5.00')
    expect(result.payoutFailures[0].reconciliation.restored).toBe(true)
    expect(result.payoutFailures[0].balanceSnapshot?.availableAmount).toBe('12.50')
  })
})
