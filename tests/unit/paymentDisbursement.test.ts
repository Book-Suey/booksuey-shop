import { describe, expect, it } from 'vitest'
import { PaymentDisbursement } from '../../server/models/PaymentDisbursement'

describe('payment disbursement model', () => {
  it('accepts valid paypal and venmo method types', () => {
    const paypalDoc = new PaymentDisbursement({
      disbursementId: 'disb_test_paypal',
      payoutRequestId: 'payout_test_1',
      idempotencyKey: 'idem-test-1',
      methodType: 'paypal',
      providerReferenceId: 'provider-ref-1',
      amount: '10.00',
      currency: 'USD',
      status: 'paid',
      disbursedAt: new Date('2026-05-07T00:00:00.000Z')
    })

    const venmoDoc = new PaymentDisbursement({
      disbursementId: 'disb_test_venmo',
      payoutRequestId: 'payout_test_2',
      idempotencyKey: 'idem-test-2',
      methodType: 'venmo',
      providerReferenceId: 'provider-ref-2',
      amount: '5.00',
      currency: 'USD',
      status: 'failed',
      disbursedAt: new Date('2026-05-07T01:00:00.000Z'),
      failureReason: 'Test failure'
    })

    expect(paypalDoc.validateSync()).toBeUndefined()
    expect(venmoDoc.validateSync()).toBeUndefined()
  })

  it('rejects unsupported methodType values', () => {
    const invalidDoc = new PaymentDisbursement({
      disbursementId: 'disb_test_invalid',
      payoutRequestId: 'payout_test_3',
      idempotencyKey: 'idem-test-3',
      methodType: 'ach',
      providerReferenceId: 'provider-ref-3',
      amount: '5.00',
      currency: 'USD',
      status: 'paid',
      disbursedAt: new Date('2026-05-07T02:00:00.000Z')
    })

    const validationError = invalidDoc.validateSync()
    expect(validationError).toBeDefined()
    expect(validationError?.errors.methodType).toBeDefined()
  })
})
