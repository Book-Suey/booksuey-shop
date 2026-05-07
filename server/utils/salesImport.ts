import crypto from 'crypto'
import { parse } from 'csv-parse/sync'
import Decimal from 'decimal.js'

const MAX_CSV_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000

function createImportError(statusCode: number, statusMessage: string): Error {
  const maybeCreateError = (globalThis as { createError?: (input: { statusCode: number, statusMessage: string }) => Error }).createError
  if (typeof maybeCreateError === 'function') {
    return maybeCreateError({ statusCode, statusMessage })
  }

  const error = new Error(statusMessage) as Error & { statusCode: number, statusMessage: string }
  error.statusCode = statusCode
  error.statusMessage = statusMessage
  return error
}

export const REQUIRED_COLUMNS = [
  'Date',
  'Time',
  'Source',
  'Extended',
  'Discount',
  'Cost',
  'Credit',
  'Title',
  'Quantity',
  'Unit',
  'Sale/Order ID'
] as const

export type ImportRowError = {
  code: string
  rowNumber: number
  reason: string
  hint: string
}

export type ParsedSalesRow = {
  rowNumber: number
  soldAt: Date
  date: string
  source: string
  saleOrderId: string
  sourceRowKey: string
  grossAmount: string
  commissionAmount: string
  cost: string
  credit: string
  title: string
  quantity: number
  unit: string
  discount: string
  extended: string
}

function isNonNegativeDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim())
}

function normalizeSource(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function parseDateTime(date: string, time: string): Date | null {
  const soldAt = new Date(`${date} ${time}`)
  if (Number.isNaN(soldAt.getTime())) {
    return null
  }
  return soldAt
}

function computeSourceRowKey(input: {
  date: string
  time: string
  source: string
  saleOrderId: string
  title: string
  quantity: string
  unit: string
  discount: string
  extended: string
  cost: string
  credit: string
}): string {
  const fingerprint = [
    input.date.trim(),
    input.time.trim(),
    normalizeSource(input.source),
    input.saleOrderId.trim(),
    input.title.trim(),
    input.quantity.trim(),
    input.unit.trim(),
    input.discount.trim(),
    input.extended.trim(),
    input.cost.trim(),
    input.credit.trim()
  ].join('|')

  return crypto.createHash('sha256').update(fingerprint).digest('hex')
}

export function normalizeApprovedVendorSource(firstName: string, lastName: string): string {
  return normalizeSource(`${firstName} ${lastName}`)
}

export function computeLedgerAmount(cost: string, credit: string): string {
  const costDecimal = new Decimal(cost)
  const creditDecimal = new Decimal(credit)
  return Decimal.max(costDecimal, creditDecimal).toFixed(2)
}

export function parseAndValidateSalesCsv(csvContent: string): {
  rows: ParsedSalesRow[]
  rowErrors: ImportRowError[]
  duplicateRows: number
  totalRows: number
} {
  const bytes = Buffer.byteLength(csvContent, 'utf8')
  if (bytes > MAX_CSV_BYTES) {
    throw createImportError(400, 'IMPORT_INVALID_FILE_FORMAT: CSV exceeds 10MB upload limit')
  }

  let records: Array<Record<string, string>>
  try {
    records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as Array<Record<string, string>>
  } catch {
    throw createImportError(400, 'IMPORT_INVALID_FILE_FORMAT: Unable to parse CSV')
  }

  if (records.length > MAX_ROWS) {
    throw createImportError(400, 'IMPORT_INVALID_FILE_FORMAT: CSV exceeds 5000 row limit')
  }

  const firstRecord = records[0]
  const headerSet = new Set(firstRecord ? Object.keys(firstRecord) : [])
  const missingColumns = REQUIRED_COLUMNS.filter(column => !headerSet.has(column))
  if (missingColumns.length > 0) {
    throw createImportError(400, `IMPORT_MISSING_REQUIRED_COLUMN: ${missingColumns.join(', ')}`)
  }

  const rows: ParsedSalesRow[] = []
  const rowErrors: ImportRowError[] = []
  const seenRowKeys = new Set<string>()
  let duplicateRows = 0

  records.forEach((record, index) => {
    const rowNumber = index + 2
    const date = (record.Date || '').trim()
    const time = (record.Time || '').trim()
    const source = (record.Source || '').trim()
    const saleOrderId = (record['Sale/Order ID'] || '').trim()
    const title = (record.Title || '').trim()
    const quantityRaw = (record.Quantity || '').trim()
    const unitRaw = (record.Unit || '').trim()
    const discountRaw = (record.Discount || '').trim()
    const extendedRaw = (record.Extended || '').trim()
    const costRaw = (record.Cost || '').trim()
    const creditRaw = (record.Credit || '').trim()
    const currencyRaw = (record.Currency || '').trim()

    if (!source) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Empty Source value', hint: 'Provide first_name + last_name in Source column' })
      return
    }

    if (!saleOrderId) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Missing Sale/Order ID', hint: 'Provide Sale/Order ID as a source reference from the CSV' })
      return
    }

    if (!title) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Missing Title', hint: 'Provide Title value for vendor-visible detail' })
      return
    }

    if (!/^\d+$/.test(quantityRaw) || Number(quantityRaw) <= 0) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Invalid Quantity', hint: 'Quantity must be a positive integer' })
      return
    }

    if (!isNonNegativeDecimal(unitRaw)) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Invalid Unit', hint: 'Unit must be a non-negative decimal value' })
      return
    }

    if (!isNonNegativeDecimal(discountRaw) || !isNonNegativeDecimal(extendedRaw) || !isNonNegativeDecimal(costRaw) || !isNonNegativeDecimal(creditRaw)) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Invalid amount field', hint: 'Extended, Discount, Cost, and Credit must be non-negative decimals' })
      return
    }

    if (currencyRaw && currencyRaw !== 'USD') {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Invalid Currency', hint: 'Currency must be USD' })
      return
    }

    const soldAt = parseDateTime(date, time)
    if (!soldAt) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Unparseable Date/Time', hint: 'Ensure Date and Time can be parsed into a valid timestamp' })
      return
    }

    const sourceRowKey = computeSourceRowKey({
      date,
      time,
      source,
      saleOrderId,
      title,
      quantity: quantityRaw,
      unit: unitRaw,
      discount: discountRaw,
      extended: extendedRaw,
      cost: costRaw,
      credit: creditRaw
    })
    if (seenRowKeys.has(sourceRowKey)) {
      duplicateRows += 1
      return
    }
    seenRowKeys.add(sourceRowKey)

    rows.push({
      rowNumber,
      soldAt,
      date,
      source,
      saleOrderId,
      sourceRowKey,
      grossAmount: new Decimal(extendedRaw).toFixed(2),
      commissionAmount: new Decimal(discountRaw).toFixed(2),
      cost: new Decimal(costRaw).toFixed(2),
      credit: new Decimal(creditRaw).toFixed(2),
      title,
      quantity: Number(quantityRaw),
      unit: new Decimal(unitRaw).toFixed(2),
      discount: new Decimal(discountRaw).toFixed(2),
      extended: new Decimal(extendedRaw).toFixed(2)
    })
  })

  return {
    rows,
    rowErrors,
    duplicateRows,
    totalRows: records.length
  }
}

export function normalizeImportSource(value: string): string {
  return normalizeSource(value)
}
