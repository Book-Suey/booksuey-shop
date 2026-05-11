import { describe, expect, it } from 'vitest'
import { formatVenmoRecipient, isValidVenmoHandle, normalizeVenmoHandle } from '../../server/utils/venmoHandler'

describe('venmoHandler', () => {
  it('normalizes handles by trimming and removing leading at symbol', () => {
    expect(normalizeVenmoHandle('  @venmo_user  ')).toBe('venmo_user')
  })

  it('validates supported handle characters', () => {
    expect(isValidVenmoHandle('venmo-user_1')).toBe(true)
    expect(isValidVenmoHandle('@bad handle')).toBe(false)
  })

  it('formats venmo payout item using USER_HANDLE recipient type', () => {
    const item = formatVenmoRecipient({
      senderItemId: 'disb_test_1',
      venmoHandle: '@venmo_user_1',
      amount: '4.75',
      note: 'Book Suey payout'
    })

    expect(item.recipientType).toBe('USER_HANDLE')
    expect(item.recipientWallet).toBe('VENMO')
    expect(item.receiver).toBe('venmo_user_1')
    expect(item.amount).toEqual({ value: '4.75', currency: 'USD' })
  })
})
