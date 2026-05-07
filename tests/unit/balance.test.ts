import Decimal from 'decimal.js'
import { describe, it, expect } from 'vitest'
import { applyLedgerEntryToBalance } from '../../server/utils/balance'

describe('balance utilities', () => {
  it('derives available and paid amounts from ledger entry types', () => {
    const running = {
      pendingAmount: new Decimal(0),
      availableAmount: new Decimal(0),
      paidAmount: new Decimal(0)
    }

    const afterSale = applyLedgerEntryToBalance(running, { entryType: 'sale', amount: '10.00' })
    const afterReservation = applyLedgerEntryToBalance(afterSale, { entryType: 'reservation', amount: '3.00' })
    const afterRelease = applyLedgerEntryToBalance(afterReservation, { entryType: 'release', amount: '1.00' })
    const afterPaid = applyLedgerEntryToBalance(afterRelease, { entryType: 'paid', amount: '2.00' })

    expect(afterPaid.availableAmount.toFixed(2)).toBe('6.00')
    expect(afterPaid.paidAmount.toFixed(2)).toBe('2.00')
    expect(afterPaid.pendingAmount.toFixed(2)).toBe('0.00')
  })
})
