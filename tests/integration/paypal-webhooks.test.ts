import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { AuditEvent } from '../../server/models/AuditEvent'
import { LedgerEntry } from '../../server/models/LedgerEntry'
import { PaymentDisbursement } from '../../server/models/PaymentDisbursement'
import { PayoutRequest } from '../../server/models/PayoutRequest'
import { ProcessedWebhookEvent } from '../../server/models/ProcessedWebhookEvent'
import { Vendor } from '../../server/models/Vendor'
import { hashPassword } from '../../server/utils/auth'
import { clearPayPalTokenCache } from '../../server/utils/paypalClient'

let mongoServer: MongoMemoryServer
let fetchMock: ReturnType<typeof vi.fn>

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-for-integration-tests'
  process.env.BCRYPT_COST_FACTOR = '12'
  process.env.PAYPAL_ENVIRONMENT = 'sandbox'
  process.env.PAYPAL_CLIENT_ID = 'sandbox-client-id'
  process.env.PAYPAL_CLIENT_SECRET = 'sandbox-client-secret'
  process.env.PAYPAL_WEBHOOK_ID = 'sandbox-webhook-id'

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
  clearPayPalTokenCache()
  await Vendor.deleteMany({})
  await PayoutRequest.deleteMany({})
  await PaymentDisbursement.deleteMany({})
  await LedgerEntry.deleteMany({})
  await AuditEvent.deleteMany({})
  await ProcessedWebhookEvent.deleteMany({})
})

async function seedDisbursingPayout(input: {
  vendorId: string
  payoutRequestId: string
  disbursementId: string
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
    requestedAt: new Date('2026-05-09T09:00:00.000Z'),
    approvedAt: new Date('2026-05-09T09:10:00.000Z'),
    disbursingAt: new Date('2026-05-09T09:20:00.000Z')
  })

  await PaymentDisbursement.create({
    disbursementId: input.disbursementId,
    payoutRequestId: input.payoutRequestId,
    idempotencyKey: `idem_${input.payoutRequestId}`,
    methodType: 'paypal',
    providerReferenceId: 'batch-1',
    providerItemId: input.providerItemId,
    amount: input.amount,
    currency: 'USD',
    status: 'disbursing',
    disbursedAt: new Date('2026-05-09T09:21:00.000Z')
  })
}

function mockPayPalWebhookVerification(): void {
  fetchMock
    .mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'test_access_token',
      expires_in: 900
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      verification_status: 'SUCCESS'
    }), { status: 200 }))
}

function mockPayPalWebhookVerificationWithCachedToken(): void {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
    verification_status: 'SUCCESS'
  }), { status: 200 }))
}

describe('PayPal webhook processing', () => {
  it('marks disbursement paid when payout item succeeds', async () => {
    await seedDisbursingPayout({
      vendorId: 'vendor_webhook_paid',
      payoutRequestId: 'payout_webhook_paid',
      disbursementId: 'disb_webhook_paid',
      providerItemId: 'item_webhook_paid',
      amount: '5.50'
    })

    mockPayPalWebhookVerification()

    const { default: handlePayPalWebhook } = await import('../../server/api/webhooks/paypal.post')

    const result = await handlePayPalWebhook({
      headers: {
        'paypal-transmission-id': 'tx-1',
        'paypal-transmission-time': '2026-05-10T12:00:00.000Z',
        'paypal-transmission-sig': 'sig-1',
        'paypal-cert-url': 'https://api-m.paypal.com/certs/test',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: {
        id: 'WH-PAYOUT-SUCCESS-1',
        event_type: 'PAYOUT.ITEM.SUCCEEDED',
        create_time: '2026-05-10T12:00:00.000Z',
        resource: {
          payout_item_id: 'item_webhook_paid',
          transaction_status: 'SUCCESS'
        }
      }
    }) as { ok: boolean }

    expect(result.ok).toBe(true)

    const payout = await PayoutRequest.findOne({ payoutRequestId: 'payout_webhook_paid' })
    const disbursement = await PaymentDisbursement.findOne({ disbursementId: 'disb_webhook_paid' })
    const paidLedger = await LedgerEntry.findOne({ entryId: 'ledger_paid_payout_webhook_paid' })

    expect(payout?.status).toBe('paid')
    expect(disbursement?.status).toBe('paid')
    expect(paidLedger).toBeDefined()
  })

  it('is idempotent for replayed webhook events', async () => {
    await seedDisbursingPayout({
      vendorId: 'vendor_webhook_replay',
      payoutRequestId: 'payout_webhook_replay',
      disbursementId: 'disb_webhook_replay',
      providerItemId: 'item_webhook_replay',
      amount: '4.00'
    })

    const { default: handlePayPalWebhook } = await import('../../server/api/webhooks/paypal.post')

    mockPayPalWebhookVerification()
    await handlePayPalWebhook({
      headers: {
        'paypal-transmission-id': 'tx-2',
        'paypal-transmission-time': '2026-05-10T13:00:00.000Z',
        'paypal-transmission-sig': 'sig-2',
        'paypal-cert-url': 'https://api-m.paypal.com/certs/test',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: {
        id: 'WH-PAYOUT-REPLAY-1',
        event_type: 'PAYOUT.ITEM.SUCCEEDED',
        create_time: '2026-05-10T13:00:00.000Z',
        resource: {
          payout_item_id: 'item_webhook_replay',
          transaction_status: 'SUCCESS'
        }
      }
    })

    mockPayPalWebhookVerificationWithCachedToken()
    await handlePayPalWebhook({
      headers: {
        'paypal-transmission-id': 'tx-3',
        'paypal-transmission-time': '2026-05-10T13:00:10.000Z',
        'paypal-transmission-sig': 'sig-3',
        'paypal-cert-url': 'https://api-m.paypal.com/certs/test',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: {
        id: 'WH-PAYOUT-REPLAY-1',
        event_type: 'PAYOUT.ITEM.SUCCEEDED',
        create_time: '2026-05-10T13:00:10.000Z',
        resource: {
          payout_item_id: 'item_webhook_replay',
          transaction_status: 'SUCCESS'
        }
      }
    })

    const paidEntries = await LedgerEntry.find({ referenceId: 'payout_webhook_replay', entryType: 'paid' })
    expect(paidEntries).toHaveLength(1)
  })

  it('handles PAYMENT.PAYOUTS-ITEM.SUCCEEDED event naming variant', async () => {
    await seedDisbursingPayout({
      vendorId: 'vendor_webhook_variant_paid',
      payoutRequestId: 'payout_webhook_variant_paid',
      disbursementId: 'disb_webhook_variant_paid',
      providerItemId: 'item_webhook_variant_paid',
      amount: '3.25'
    })

    mockPayPalWebhookVerification()

    const { default: handlePayPalWebhook } = await import('../../server/api/webhooks/paypal.post')

    await handlePayPalWebhook({
      headers: {
        'paypal-transmission-id': 'tx-variant-1',
        'paypal-transmission-time': '2026-05-10T14:10:00.000Z',
        'paypal-transmission-sig': 'sig-variant-1',
        'paypal-cert-url': 'https://api-m.paypal.com/certs/test',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: {
        id: 'WH-PAYOUT-VARIANT-SUCCESS-1',
        event_type: 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED',
        create_time: '2026-05-10T14:10:00.000Z',
        resource: {
          payout_item_id: 'item_webhook_variant_paid',
          transaction_status: 'SUCCESS'
        }
      }
    })

    const payout = await PayoutRequest.findOne({ payoutRequestId: 'payout_webhook_variant_paid' })
    const disbursement = await PaymentDisbursement.findOne({ disbursementId: 'disb_webhook_variant_paid' })

    expect(payout?.status).toBe('paid')
    expect(disbursement?.status).toBe('paid')
  })

  it('handles PAYMENT.PAYOUTS-ITEM.UNCLAIMED event naming variant', async () => {
    await seedDisbursingPayout({
      vendorId: 'vendor_webhook_variant_unclaimed',
      payoutRequestId: 'payout_webhook_variant_unclaimed',
      disbursementId: 'disb_webhook_variant_unclaimed',
      providerItemId: 'item_webhook_variant_unclaimed',
      amount: '6.10'
    })

    mockPayPalWebhookVerification()

    const { default: handlePayPalWebhook } = await import('../../server/api/webhooks/paypal.post')

    await handlePayPalWebhook({
      headers: {
        'paypal-transmission-id': 'tx-variant-2',
        'paypal-transmission-time': '2026-05-10T14:20:00.000Z',
        'paypal-transmission-sig': 'sig-variant-2',
        'paypal-cert-url': 'https://api-m.paypal.com/certs/test',
        'paypal-auth-algo': 'SHA256withRSA'
      },
      body: {
        id: 'WH-PAYOUT-VARIANT-UNCLAIMED-1',
        event_type: 'PAYMENT.PAYOUTS-ITEM.UNCLAIMED',
        create_time: '2026-05-10T14:20:00.000Z',
        resource: {
          payout_item_id: 'item_webhook_variant_unclaimed',
          transaction_status: 'UNCLAIMED'
        }
      }
    })

    const payout = await PayoutRequest.findOne({ payoutRequestId: 'payout_webhook_variant_unclaimed' })
    const disbursement = await PaymentDisbursement.findOne({ disbursementId: 'disb_webhook_variant_unclaimed' })

    expect(payout?.status).toBe('failed')
    expect(disbursement?.status).toBe('failed')
  })
})
