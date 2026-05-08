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

function normalizeImportDecimal(value: string): string | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const normalizedValue = trimmedValue
    .replace(/^\$\s*/, '')
    .replace(/,/g, '')

  if (!/^\d+(\.\d+)?$/.test(normalizedValue)) {
    return null
  }

  return normalizedValue
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

const SOURCE_ROW_KEY_COLUMNS = [
  'Sale/Order ID',
  'ISBN',
  'Barcode',
  'Title',
  'Authors',
  'Line Type',
  'Condition',
  'Section',
  'Location',
  'Binding',
  'Publisher',
  'Source',
  'Event',
  'Quantity',
  'Register'
] as const

function normalizeSource(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function parseDateTime(date: string, time: string): Date | null {
  const trimmedDate = date.trim()
  const trimmedTime = time.trim()

  let month: number
  let day: number
  let year: number

  const slashDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmedDate)
  const isoDateMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmedDate)
  const dashedDateMatch = /^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/.exec(trimmedDate)

  if (slashDateMatch) {
    month = Number.parseInt(slashDateMatch[1] || '', 10)
    day = Number.parseInt(slashDateMatch[2] || '', 10)
    year = Number.parseInt(slashDateMatch[3] || '', 10)
  } else if (isoDateMatch) {
    year = Number.parseInt(isoDateMatch[1] || '', 10)
    month = Number.parseInt(isoDateMatch[2] || '', 10)
    day = Number.parseInt(isoDateMatch[3] || '', 10)
  } else if (dashedDateMatch) {
    month = Number.parseInt(dashedDateMatch[1] || '', 10)
    day = Number.parseInt(dashedDateMatch[2] || '', 10)
    const parsedYear = Number.parseInt(dashedDateMatch[3] || '', 10)
    year = String(dashedDateMatch[3]).length === 2 ? 2000 + parsedYear : parsedYear
  } else {
    return null
  }

  let hour24: number
  let minute: number

  const meridiemTimeMatch = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(trimmedTime)
  const twentyFourHourMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmedTime)

  if (meridiemTimeMatch) {
    const hour12 = Number.parseInt(meridiemTimeMatch[1] || '', 10)
    minute = Number.parseInt(meridiemTimeMatch[2] || '', 10)
    const meridiem = (meridiemTimeMatch[3] || '').toUpperCase()

    if (hour12 < 1 || hour12 > 12 || minute < 0 || minute > 59) {
      return null
    }

    hour24 = hour12 % 12
    if (meridiem === 'PM') {
      hour24 += 12
    }
  } else if (twentyFourHourMatch) {
    hour24 = Number.parseInt(twentyFourHourMatch[1] || '', 10)
    minute = Number.parseInt(twentyFourHourMatch[2] || '', 10)

    if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) {
      return null
    }
  } else {
    return null
  }

  if (
    month < 1 || month > 12
    || day < 1 || day > 31
  ) {
    return null
  }

  const soldAt = new Date(year, month - 1, day, hour24, minute, 0, 0)
  if (
    Number.isNaN(soldAt.getTime())
    || soldAt.getFullYear() !== year
    || soldAt.getMonth() !== month - 1
    || soldAt.getDate() !== day
    || soldAt.getHours() !== hour24
    || soldAt.getMinutes() !== minute
  ) {
    return null
  }
  return soldAt
}

function computeSourceRowKey(input: {
  record: Record<string, string>
  soldAt: Date
  normalizedSource: string
  quantity: string
  unit: string
  discount: string
  extended: string
  cost: string
  credit: string
}): string {
  const normalizedRecordValues = SOURCE_ROW_KEY_COLUMNS.map((column) => {
    const rawValue = (input.record[column] || '').trim()

    if (column === 'Source') {
      return input.normalizedSource
    }

    if (column === 'Quantity') {
      return input.quantity.trim()
    }

    return rawValue
  })

  const fingerprint = [
    input.soldAt.toISOString(),
    ...normalizedRecordValues,
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
    const normalizedUnit = normalizeImportDecimal(unitRaw)
    const normalizedDiscount = normalizeImportDecimal(discountRaw)
    const normalizedExtended = normalizeImportDecimal(extendedRaw)
    const normalizedCost = normalizeImportDecimal(costRaw)
    const normalizedCredit = normalizeImportDecimal(creditRaw)

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

    if (!normalizedUnit) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Invalid Unit', hint: 'Unit must be a non-negative decimal value' })
      return
    }

    if (!normalizedDiscount || !normalizedExtended || !normalizedCost || !normalizedCredit) {
      rowErrors.push({ code: 'IMPORT_INVALID_ROW_DATA', rowNumber, reason: 'Invalid amount field', hint: 'Extended, Discount, Cost, and Credit must be non-negative decimals. A leading $ is allowed.' })
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
      record,
      soldAt,
      normalizedSource: normalizeSource(source),
      quantity: String(Number(quantityRaw)),
      unit: normalizedUnit,
      discount: normalizedDiscount,
      extended: normalizedExtended,
      cost: normalizedCost,
      credit: normalizedCredit
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
      grossAmount: new Decimal(normalizedExtended).toFixed(2),
      commissionAmount: computeLedgerAmount(normalizedCost, normalizedCredit),
      cost: new Decimal(normalizedCost).toFixed(2),
      credit: new Decimal(normalizedCredit).toFixed(2),
      title,
      quantity: Number(quantityRaw),
      unit: new Decimal(normalizedUnit).toFixed(2),
      discount: new Decimal(normalizedDiscount).toFixed(2),
      extended: new Decimal(normalizedExtended).toFixed(2)
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
