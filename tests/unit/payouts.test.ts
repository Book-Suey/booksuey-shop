import { describe, expect, it } from 'vitest'
import {
  PAYOUT_REQUEST_STATUSES,
  canTransitionPayoutRequestStatus,
  formatUsdAmount,
  parsePositivePayoutAmount
} from '../../server/utils/payouts'

describe('payout utilities', () => {
  it('exposes the supported payout statuses', () => {
    expect(PAYOUT_REQUEST_STATUSES).toEqual([
      'requested',
      'approved',
      'rejected',
      'disbursing',
      'paid',
      'failed'
    ])
  })

  it('validates allowed payout status transitions', () => {
    expect(canTransitionPayoutRequestStatus('requested', 'approved')).toBe(true)
    expect(canTransitionPayoutRequestStatus('requested', 'rejected')).toBe(true)
    expect(canTransitionPayoutRequestStatus('approved', 'disbursing')).toBe(true)
    expect(canTransitionPayoutRequestStatus('disbursing', 'paid')).toBe(true)
    expect(canTransitionPayoutRequestStatus('paid', 'requested')).toBe(false)
    expect(canTransitionPayoutRequestStatus('rejected', 'approved')).toBe(false)
  })

  it('accepts only positive payout amounts', () => {
    expect(formatUsdAmount(parsePositivePayoutAmount('12.5'))).toBe('12.50')
    expect(() => parsePositivePayoutAmount('0')).toThrow(/PAYOUT_INVALID_AMOUNT/)
    expect(() => parsePositivePayoutAmount('-1')).toThrow(/PAYOUT_INVALID_AMOUNT/)
    expect(() => parsePositivePayoutAmount('abc')).toThrow(/PAYOUT_INVALID_AMOUNT/)
  })
})
