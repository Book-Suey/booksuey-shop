import { describe, it, expect } from 'vitest'
import {
  computeLedgerAmount,
  parseAndValidateSalesCsv,
  normalizeApprovedVendorSource
} from '../../server/utils/salesImport'

const csvHeader = 'Date,Time,Source,Extended,Discount,Cost,Credit,Title,Quantity,Unit,Sale/Order ID\n'

describe('sales import utilities', () => {
  it('parses valid report rows', () => {
    const csv = `${csvHeader}05/01/2026,10:15 AM,Jane Doe,12.50,2.50,8.00,7.00,Book A,1,12.50,SO-100\n`

    const result = parseAndValidateSalesCsv(csv)

    expect(result.totalRows).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rowErrors).toHaveLength(0)
    expect(result.duplicateRows).toBe(0)
    expect(result.rows[0].saleOrderId).toBe('SO-100')
    expect(result.rows[0].grossAmount).toBe('12.50')
    expect(result.rows[0].commissionAmount).toBe('8.00')
    expect(result.rows[0].sourceRowKey).not.toBe('SO-100')
  })

  it('parses POS export rows with dollar-prefixed decimal fields', () => {
    const csv = `${csvHeader}2026-05-01,2:28 PM,Jane Doe,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-101\n`

    const result = parseAndValidateSalesCsv(csv)

    expect(result.totalRows).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rowErrors).toHaveLength(0)
    expect(result.rows[0].grossAmount).toBe('12.50')
    expect(result.rows[0].commissionAmount).toBe('8.00')
    expect(result.rows[0].unit).toBe('12.50')
    expect(result.rows[0].cost).toBe('8.00')
    expect(result.rows[0].credit).toBe('7.00')
  })

  it('parses legacy POS export rows with dashed dates and 24-hour times', () => {
    const csv = `${csvHeader}02-01-26,14:28,Jane Doe,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-102\n`

    const result = parseAndValidateSalesCsv(csv)

    expect(result.totalRows).toBe(1)
    expect(result.rows).toHaveLength(1)
    expect(result.rowErrors).toHaveLength(0)
  })

  it('rejects missing required columns', () => {
    const csv = 'Date,Time,Source\n05/01/2026,10:15 AM,Jane Doe\n'

    expect(() => parseAndValidateSalesCsv(csv)).toThrow(/IMPORT_MISSING_REQUIRED_COLUMN/)
  })

  it('rejects malformed decimal fields', () => {
    const csv = `${csvHeader}05/01/2026,10:15 AM,Jane Doe,abc,2.50,8.00,7.00,Book A,1,12.50,SO-100\n`

    const result = parseAndValidateSalesCsv(csv)

    expect(result.rows).toHaveLength(0)
    expect(result.rowErrors).toHaveLength(1)
    expect(result.rowErrors[0].reason).toContain('Invalid amount field')
  })

  it('rejects unparseable date time rows', () => {
    const csv = `${csvHeader}not-a-date,10:15 AM,Jane Doe,12.50,2.50,8.00,7.00,Book A,1,12.50,SO-100\n`

    const result = parseAndValidateSalesCsv(csv)

    expect(result.rows).toHaveLength(0)
    expect(result.rowErrors).toHaveLength(1)
    expect(result.rowErrors[0].reason).toContain('Unparseable Date/Time')
  })

  it('allows multiple items from the same source sale id when row content differs', () => {
    const csv = `${csvHeader}05/01/2026,10:15 AM,Jane Doe,12.50,2.50,8.00,7.00,Book A,1,12.50,SO-100\n05/01/2026,10:15 AM,Jane Doe,20.00,3.00,9.00,8.00,Book B,1,20.00,SO-100\n`

    const result = parseAndValidateSalesCsv(csv)

    expect(result.totalRows).toBe(2)
    expect(result.rows).toHaveLength(2)
    expect(result.duplicateRows).toBe(0)
  })

  it('detects duplicate source row keys only when the full item row repeats', () => {
    const csv = `${csvHeader}05/01/2026,10:15 AM,Jane Doe,12.50,2.50,8.00,7.00,Book A,1,12.50,SO-100\n05/01/2026,10:15 AM,Jane Doe,12.50,2.50,8.00,7.00,Book A,1,12.50,SO-100\n`

    const result = parseAndValidateSalesCsv(csv)

    expect(result.totalRows).toBe(2)
    expect(result.rows).toHaveLength(1)
    expect(result.duplicateRows).toBe(1)
  })

  it('does not dedupe distinct POS line items that share the same sale order id', () => {
    const csv = [
      'Date,Time,Source,Extended,Discount,Cost,Credit,Title,Quantity,Unit,Sale/Order ID,ISBN,Barcode,Register',
      '2026-05-01,2:28 PM,Jane Doe,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-100,9780000000001,111,Drawer1',
      '2026-05-01,2:28 PM,Jane Doe,$12.50,$2.50,$8.00,$7.00,Book A,1,$12.50,SO-100,9780000000002,222,Drawer1'
    ].join('\n') + '\n'

    const result = parseAndValidateSalesCsv(csv)

    expect(result.totalRows).toBe(2)
    expect(result.rows).toHaveLength(2)
    expect(result.duplicateRows).toBe(0)
    expect(result.rows[0].sourceRowKey).not.toBe(result.rows[1].sourceRowKey)
  })

  it('computes ledger amount as max(cost, credit)', () => {
    expect(computeLedgerAmount('8.00', '7.00')).toBe('8.00')
    expect(computeLedgerAmount('8.00', '9.25')).toBe('9.25')
  })

  it('normalizes approved vendor source values', () => {
    expect(normalizeApprovedVendorSource('Jane', 'Doe')).toBe('jane doe')
  })
})
