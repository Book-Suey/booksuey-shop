import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { LedgerEntry } from '../../server/models/LedgerEntry'
import { PaymentDisbursement } from '../../server/models/PaymentDisbursement'
import { PayoutRequest } from '../../server/models/PayoutRequest'
import { Vendor } from '../../server/models/Vendor'
import { generateToken, hashPassword } from '../../server/utils/auth'

let mongoServer: MongoMemoryServer
let fetchMock: ReturnType<typeof vi.fn>

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-for-integration-tests'
  process.env.JWT_EXPIRES_IN = '7d'
  process.env.BCRYPT_COST_FACTOR = '12'
  process.env.PAYPAL_ENVIRONMENT = 'sandbox'
  process.env.PAYPAL_CLIENT_ID = 'sandbox-client-id'
  process.env.PAYPAL_CLIENT_SECRET = 'sandbox-client-secret'

  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  process.env.MONGODB_URI = uri
  await mongoose.connect(uri)

  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body ?? {})
  vi.stubGlobal('getHeader', (event: { headers?: Record<string, string | undefined> }, key: string) => event.headers?.[key])
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => {
    const error = new Error(input.statusMessage) as Error & { statusCode: number, statusMessage: string }
    error.statusCode = input.statusCode
    error.statusMessage = input.statusMessage
    return error
  })

  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  vi.resetModules()
  fetchMock.mockReset()
  await Vendor.deleteMany({})
  await PayoutRequest.deleteMany({})
  await PaymentDisbursement.deleteMany({})
  await LedgerEntry.deleteMany({})
})

function adminHeaders(): Record<string, string> {
  const { token } = generateToken({
    adminId: 'admin_recovery_1',
    email: 'admin-recovery@example.com',
    role: 'admin'
  })

  return {
    authorization: `Bearer ${token}`
  }
}

async function seedDisbursingPayout(input: {
  vendorId: string
  payoutRequestId: string
  disbursementId: string
  providerReferenceId: string
  providerItemId: string
  amount: string
}): Promise<void> {
  await Vendor.create({
    vendorId: input.vendorId,
    legalName: `${input.vendorId} Legal`,
    displayName: `${input.vendorId} Display`,
    email: `${input.vendorId}@example.com`,
    preferredPayoutMethod: 'paypal',
    payoutRecipientName: `${input.vendorId} Recipient`,
    paypalEmail: `${input.vendorId}@paypal.example.com`,
    passwordHash: await hashPassword('StrongPass123!'),
    status: 'active'
  })

  await PayoutRequest.create({
    payoutRequestId: input.payoutRequestId,
    vendorId: input.vendorId,
    amount: input.amount,
    currency: 'USD',
    status: 'disbursing',
    requestedAt: new Date('2026-05-10T08:00:00.000Z'),
    approvedAt: new Date('2026-05-10T08:10:00.000Z'),
    disbursingAt: new Date('2026-05-10T08:20:00.000Z')
  })

  await PaymentDisbursement.create({
    disbursementId: input.disbursementId,
    payoutRequestId: input.payoutRequestId,
    idempotencyKey: `idem_${input.payoutRequestId}`,
    methodType: 'paypal',
    providerReferenceId: input.providerReferenceId,
    providerItemId: input.providerItemId,
    amount: input.amount,
    currency: 'USD',
    status: 'disbursing',
    disbursedAt: new Date('2026-05-10T08:21:00.000Z')
  })
}

function mockPayPalBatchStatus(status: string): void {
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'test_access_token',
      expires_in: 900
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      items: [
        {
          payout_item_id: 'item_recovery_1',
          transaction_status: status
        }
      ]
    }), { status: 200 }))
}

describe('Admin payout recovery endpoint', () => {
  it('reconciles disbursing payouts and marks paid when provider succeeded', async () => {
    await seedDisbursingPayout({
      vendorId: 'vendor_recovery_paid',
      payoutRequestId: 'payout_recovery_paid',
      disbursementId: 'disb_recovery_paid',
      providerReferenceId: 'batch_recovery_1',
      providerItemId: 'item_recovery_1',
      amount: '11.00'
    })

    mockPayPalBatchStatus('SUCCESS')

    const { default: recoverPayouts } = await import('../../server/api/admin/payout-recovery.post')

    const result = await recoverPayouts({
      headers: adminHeaders(),
      body: {
        action: 'reconcile',
        disbursementId: 'disb_recovery_paid'
      }
    }) as {
      action: 'reconcile'
      reconciledCount: number
      updatedCount: number
    }

    expect(result.action).toBe('reconcile')
    expect(result.reconciledCount).toBe(1)
    expect(result.updatedCount).toBe(1)

    const payout = await PayoutRequest.findOne({ payoutRequestId: 'payout_recovery_paid' })
    const disbursement = await PaymentDisbursement.findOne({ disbursementId: 'disb_recovery_paid' })
    const paidEntry = await LedgerEntry.findOne({ entryId: 'ledger_paid_payout_recovery_paid' })

    expect(payout?.status).toBe('paid')
    expect(disbursement?.status).toBe('paid')
    expect(paidEntry).toBeDefined()
  })

  it('rechecks a specific disbursement and marks failed when provider reports failure', async () => {
    await seedDisbursingPayout({
      vendorId: 'vendor_recovery_failed',
      payoutRequestId: 'payout_recovery_failed',
      disbursementId: 'disb_recovery_failed',
      providerReferenceId: 'batch_recovery_2',
      providerItemId: 'item_recovery_1',
      amount: '7.00'
    })

    mockPayPalBatchStatus('FAILED')

    const { default: recoverPayouts } = await import('../../server/api/admin/payout-recovery.post')

    const result = await recoverPayouts({
      headers: adminHeaders(),
      body: {
        action: 'recheck',
        disbursementId: 'disb_recovery_failed'
      }
    }) as {
      action: 'recheck'
      result: {
        localStatusAfter: string
        changed: boolean
      }
    }

    expect(result.action).toBe('recheck')
    expect(result.result.localStatusAfter).toBe('failed')
    expect(result.result.changed).toBe(true)

    const payout = await PayoutRequest.findOne({ payoutRequestId: 'payout_recovery_failed' })
    const disbursement = await PaymentDisbursement.findOne({ disbursementId: 'disb_recovery_failed' })
    const releaseEntry = await LedgerEntry.findOne({ entryId: 'ledger_release_payout_recovery_failed_failed' })

    expect(payout?.status).toBe('failed')
    expect(disbursement?.status).toBe('failed')
    expect(releaseEntry).toBeDefined()
  })
})
