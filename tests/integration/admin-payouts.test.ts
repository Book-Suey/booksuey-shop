import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { AuditEvent } from '../../server/models/AuditEvent'
import { LedgerEntry } from '../../server/models/LedgerEntry'
import { PaymentDisbursement } from '../../server/models/PaymentDisbursement'
import { PayoutRequest } from '../../server/models/PayoutRequest'
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
  await PayoutRequest.deleteMany({})
  await PaymentDisbursement.deleteMany({})
  await LedgerEntry.deleteMany({})
  await AuditEvent.deleteMany({})
})

function adminHeaders(): Record<string, string> {
  const { token } = generateToken({
    adminId: 'admin_payouts_1',
    email: 'admin-payouts@example.com',
    role: 'admin'
  })

  return {
    authorization: `Bearer ${token}`
  }
}

async function seedVendor(vendorId: string): Promise<void> {
  await Vendor.create({
    vendorId,
    legalName: `${vendorId} Legal Name`,
    displayName: `${vendorId} Display`,
    email: `${vendorId}@example.com`,
    passwordHash: await hashPassword('StrongPass123!'),
    status: 'active'
  })
}

async function seedRequestedPayoutWithReservation(input: {
  payoutRequestId: string
  vendorId: string
  amount: string
  requestedAt: Date
}): Promise<void> {
  await PayoutRequest.create({
    payoutRequestId: input.payoutRequestId,
    vendorId: input.vendorId,
    amount: input.amount,
    currency: 'USD',
    status: 'requested',
    requestedAt: input.requestedAt
  })

  await LedgerEntry.create({
    entryId: `ledger_reservation_${input.payoutRequestId}`,
    vendorId: input.vendorId,
    entryType: 'reservation',
    amount: input.amount,
    currency: 'USD',
    referenceType: 'PayoutRequest',
    referenceId: input.payoutRequestId,
    occurredAt: input.requestedAt
  })
}

describe('Admin Payout Review and Disbursement Endpoints', () => {
  it('lists queue entries and supports status/date filtering', async () => {
    await seedVendor('vendor_queue_1')

    await seedRequestedPayoutWithReservation({
      payoutRequestId: 'payout_queue_requested',
      vendorId: 'vendor_queue_1',
      amount: '5.00',
      requestedAt: new Date('2026-05-01T10:00:00.000Z')
    })

    await PayoutRequest.create({
      payoutRequestId: 'payout_queue_approved',
      vendorId: 'vendor_queue_1',
      amount: '3.00',
      currency: 'USD',
      status: 'approved',
      requestedAt: new Date('2026-05-02T10:00:00.000Z'),
      approvedAt: new Date('2026-05-02T11:00:00.000Z')
    })

    await PayoutRequest.create({
      payoutRequestId: 'payout_queue_paid',
      vendorId: 'vendor_queue_1',
      amount: '2.00',
      currency: 'USD',
      status: 'paid',
      requestedAt: new Date('2026-05-03T10:00:00.000Z'),
      paidAt: new Date('2026-05-03T11:00:00.000Z')
    })

    const { default: getQueue } = await import('../../server/api/admin/payout-requests/index.get')

    const queueResult = await getQueue({
      headers: adminHeaders(),
      query: {}
    }) as { payoutRequests: Array<{ payoutRequestId: string, requiresAction: boolean }> }

    expect(queueResult.payoutRequests).toHaveLength(2)
    expect(queueResult.payoutRequests.map(item => item.payoutRequestId)).toEqual([
      'payout_queue_approved',
      'payout_queue_requested'
    ])
    expect(queueResult.payoutRequests[0].requiresAction).toBe(false)
    expect(queueResult.payoutRequests[1].requiresAction).toBe(true)

    const filteredResult = await getQueue({
      headers: adminHeaders(),
      query: {
        status: 'requested',
        dateFrom: '2026-05-01T00:00:00.000Z',
        dateTo: '2026-05-01T23:59:59.000Z'
      }
    }) as { payoutRequests: Array<{ payoutRequestId: string }> }

    expect(filteredResult.payoutRequests).toHaveLength(1)
    expect(filteredResult.payoutRequests[0].payoutRequestId).toBe('payout_queue_requested')
  })

  it('approves requested payouts and records payout approval audit', async () => {
    await seedVendor('vendor_approve_1')
    await seedRequestedPayoutWithReservation({
      payoutRequestId: 'payout_approve_1',
      vendorId: 'vendor_approve_1',
      amount: '4.00',
      requestedAt: new Date('2026-05-04T09:00:00.000Z')
    })

    const { default: approvePayout } = await import('../../server/api/admin/payout-requests/[payoutId]/approve.post')

    const result = await approvePayout({
      headers: adminHeaders(),
      params: { payoutId: 'payout_approve_1' },
      body: { reviewNote: 'Looks good' }
    }) as { payoutRequest: { status: string, reviewedBy: string, reviewNote: string } }

    expect(result.payoutRequest.status).toBe('approved')
    expect(result.payoutRequest.reviewedBy).toBe('admin_payouts_1')
    expect(result.payoutRequest.reviewNote).toBe('Looks good')

    const auditEvent = await AuditEvent.findOne({
      action: 'payout_approved',
      entityId: 'payout_approve_1'
    })

    expect(auditEvent).toBeDefined()
  })

  it('rejects approvals when reserved funds are missing', async () => {
    await seedVendor('vendor_approve_insufficient')

    await LedgerEntry.create({
      entryId: 'ledger_sale_insufficient',
      vendorId: 'vendor_approve_insufficient',
      entryType: 'sale',
      amount: '1.00',
      currency: 'USD',
      referenceType: 'SaleRecord',
      referenceId: 'sale_1',
      occurredAt: new Date('2026-05-04T09:00:00.000Z')
    })

    await PayoutRequest.create({
      payoutRequestId: 'payout_approve_insufficient',
      vendorId: 'vendor_approve_insufficient',
      amount: '2.00',
      currency: 'USD',
      status: 'requested',
      requestedAt: new Date('2026-05-04T10:00:00.000Z')
    })

    const { default: approvePayout } = await import('../../server/api/admin/payout-requests/[payoutId]/approve.post')

    await expect(approvePayout({
      headers: adminHeaders(),
      params: { payoutId: 'payout_approve_insufficient' },
      body: {}
    })).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('rejects requested payout and restores available balance', async () => {
    await seedVendor('vendor_reject_1')

    await LedgerEntry.create({
      entryId: 'ledger_sale_reject_1',
      vendorId: 'vendor_reject_1',
      entryType: 'sale',
      amount: '7.00',
      currency: 'USD',
      referenceType: 'SaleRecord',
      referenceId: 'sale_reject_1',
      occurredAt: new Date('2026-05-05T08:00:00.000Z')
    })

    await seedRequestedPayoutWithReservation({
      payoutRequestId: 'payout_reject_1',
      vendorId: 'vendor_reject_1',
      amount: '3.00',
      requestedAt: new Date('2026-05-05T09:00:00.000Z')
    })

    const { default: rejectPayout } = await import('../../server/api/admin/payout-requests/[payoutId]/reject.post')

    const result = await rejectPayout({
      headers: adminHeaders(),
      params: { payoutId: 'payout_reject_1' },
      body: { reason: 'Compliance review failed' }
    }) as {
      payoutRequest: { status: string, rejectionReason: string }
      balance: { pendingAmount: string, availableAmount: string }
    }

    expect(result.payoutRequest.status).toBe('rejected')
    expect(result.payoutRequest.rejectionReason).toBe('Compliance review failed')
    expect(result.balance.pendingAmount).toBe('0.00')
    expect(result.balance.availableAmount).toBe('7.00')

    const releaseEntry = await LedgerEntry.findOne({
      entryType: 'release',
      referenceId: 'payout_reject_1'
    })

    expect(releaseEntry).toBeDefined()

    const auditEvent = await AuditEvent.findOne({
      action: 'payout_rejected',
      entityId: 'payout_reject_1'
    })

    expect(auditEvent).toBeDefined()
  })

  it('creates successful paypal disbursement and moves amount to paid', async () => {
    await seedVendor('vendor_disburse_paid')
    await seedRequestedPayoutWithReservation({
      payoutRequestId: 'payout_disburse_paid',
      vendorId: 'vendor_disburse_paid',
      amount: '6.00',
      requestedAt: new Date('2026-05-06T09:00:00.000Z')
    })

    await PayoutRequest.updateOne(
      { payoutRequestId: 'payout_disburse_paid' },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date('2026-05-06T09:10:00.000Z')
        }
      }
    )

    const { default: createDisbursement } = await import('../../server/api/admin/disbursements.post')

    const result = await createDisbursement({
      headers: adminHeaders(),
      body: {
        payoutRequestId: 'payout_disburse_paid',
        methodType: 'paypal',
        idempotencyKey: 'idem-paid-1',
        providerReferenceId: 'paypal-ref-123'
      }
    }) as {
      disbursement: { status: string, providerReferenceId: string }
      payoutRequest: { status: string }
      balance: { pendingAmount: string, paidAmount: string }
    }

    expect(result.disbursement.status).toBe('paid')
    expect(result.disbursement.providerReferenceId).toBe('paypal-ref-123')
    expect(result.payoutRequest.status).toBe('paid')
    expect(result.balance.pendingAmount).toBe('0.00')
    expect(result.balance.paidAmount).toBe('6.00')

    const paidLedgerEntry = await LedgerEntry.findOne({
      entryType: 'paid',
      referenceId: 'payout_disburse_paid'
    })

    expect(paidLedgerEntry).toBeDefined()
  })

  it('creates failed venmo disbursement and releases reserved balance', async () => {
    await seedVendor('vendor_disburse_failed')

    await LedgerEntry.create({
      entryId: 'ledger_sale_disburse_failed',
      vendorId: 'vendor_disburse_failed',
      entryType: 'sale',
      amount: '9.00',
      currency: 'USD',
      referenceType: 'SaleRecord',
      referenceId: 'sale_disburse_failed',
      occurredAt: new Date('2026-05-06T08:00:00.000Z')
    })

    await seedRequestedPayoutWithReservation({
      payoutRequestId: 'payout_disburse_failed',
      vendorId: 'vendor_disburse_failed',
      amount: '4.00',
      requestedAt: new Date('2026-05-06T09:00:00.000Z')
    })

    await PayoutRequest.updateOne(
      { payoutRequestId: 'payout_disburse_failed' },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date('2026-05-06T09:10:00.000Z')
        }
      }
    )

    const { default: createDisbursement } = await import('../../server/api/admin/disbursements.post')

    const result = await createDisbursement({
      headers: adminHeaders(),
      body: {
        payoutRequestId: 'payout_disburse_failed',
        methodType: 'venmo',
        idempotencyKey: 'idem-failed-1',
        providerReferenceId: 'venmo-ref-456',
        outcome: 'failed',
        failureReason: 'Processor declined'
      }
    }) as {
      disbursement: { status: string, failureReason?: string }
      payoutRequest: { status: string }
      balance: { pendingAmount: string, availableAmount: string }
    }

    expect(result.disbursement.status).toBe('failed')
    expect(result.disbursement.failureReason).toBe('Processor declined')
    expect(result.payoutRequest.status).toBe('failed')
    expect(result.balance.pendingAmount).toBe('0.00')
    expect(result.balance.availableAmount).toBe('9.00')
  })

  it('rejects unsupported disbursement method and supports idempotent replay', async () => {
    await seedVendor('vendor_disburse_misc')
    await seedRequestedPayoutWithReservation({
      payoutRequestId: 'payout_disburse_misc',
      vendorId: 'vendor_disburse_misc',
      amount: '2.00',
      requestedAt: new Date('2026-05-06T09:00:00.000Z')
    })

    await PayoutRequest.updateOne(
      { payoutRequestId: 'payout_disburse_misc' },
      {
        $set: {
          status: 'approved',
          approvedAt: new Date('2026-05-06T09:10:00.000Z')
        }
      }
    )

    const { default: createDisbursement } = await import('../../server/api/admin/disbursements.post')

    await expect(createDisbursement({
      headers: adminHeaders(),
      body: {
        payoutRequestId: 'payout_disburse_misc',
        methodType: 'ach',
        idempotencyKey: 'idem-unsupported',
        providerReferenceId: 'unsupported-ref'
      }
    })).rejects.toMatchObject({
      statusCode: 400
    })

    const first = await createDisbursement({
      headers: adminHeaders(),
      body: {
        payoutRequestId: 'payout_disburse_misc',
        methodType: 'paypal',
        idempotencyKey: 'idem-replay',
        providerReferenceId: 'replay-ref'
      }
    }) as { disbursement: { disbursementId: string }, idempotentReplay?: boolean }

    const second = await createDisbursement({
      headers: adminHeaders(),
      body: {
        payoutRequestId: 'payout_disburse_misc',
        methodType: 'paypal',
        idempotencyKey: 'idem-replay',
        providerReferenceId: 'replay-ref'
      }
    }) as { disbursement: { disbursementId: string }, idempotentReplay?: boolean }

    expect(second.idempotentReplay).toBe(true)
    expect(second.disbursement.disbursementId).toBe(first.disbursement.disbursementId)
  })
})
