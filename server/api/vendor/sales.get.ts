import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { SalesImportBatch } from '../../models/SalesImportBatch'
import { SaleRecord } from '../../models/SaleRecord'
import { requireVendorId } from '../../utils/vendorContext'

const salesQuerySchema = z.object({
  sourcePeriod: z.string().min(1).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
})

function parseOptionalDate(value: string | undefined, fieldName: string): Date | undefined {
  if (!value) {
    return undefined
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `INVALID_QUERY: ${fieldName} must be a valid date`
    })
  }

  return parsed
}

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorId = requireVendorId(event)
  const parsedQuery = salesQuerySchema.safeParse(getQuery(event))

  if (!parsedQuery.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'INVALID_QUERY: Invalid sales filters'
    })
  }

  const { sourcePeriod, dateFrom, dateTo } = parsedQuery.data
  const soldAt = {} as { $gte?: Date, $lte?: Date }
  const soldAtStart = parseOptionalDate(dateFrom, 'dateFrom')
  const soldAtEnd = parseOptionalDate(dateTo, 'dateTo')

  if (soldAtStart) {
    soldAt.$gte = soldAtStart
  }

  if (soldAtEnd) {
    soldAt.$lte = soldAtEnd
  }

  const saleQuery = {
    vendorId,
    ...(Object.keys(soldAt).length > 0 ? { soldAt } : {})
  } as {
    vendorId: string
    soldAt?: { $gte?: Date, $lte?: Date }
    sourceBatchId?: { $in: string[] }
  }

  if (sourcePeriod) {
    const batches = await SalesImportBatch.find({ sourcePeriod }, { batchId: 1, _id: 0 })
    const batchIds = batches.map((batch: { batchId: string }) => batch.batchId)

    if (batchIds.length === 0) {
      return { sales: [] }
    }

    saleQuery.sourceBatchId = { $in: batchIds }
  }

  const sales = await SaleRecord.find(saleQuery).sort({ soldAt: -1, _id: -1 })
  const batchIds = Array.from(new Set(sales.map((sale: { sourceBatchId: string }) => sale.sourceBatchId)))

  const sourcePeriodsByBatchId = new Map<string, string>()
  if (batchIds.length > 0) {
    const batches = await SalesImportBatch.find(
      { batchId: { $in: batchIds } },
      { batchId: 1, sourcePeriod: 1, _id: 0 }
    )

    for (const batch of batches as Array<{ batchId: string, sourcePeriod: string }>) {
      sourcePeriodsByBatchId.set(batch.batchId, batch.sourcePeriod)
    }
  }

  return {
    sales: sales.map((sale: {
      _id: string
      sourceBatchId: string
      soldAt: Date
      title: string
      quantity: number
      unit: { toString(): string }
      discount: { toString(): string }
      extended: { toString(): string }
      grossAmount: { toString(): string }
      commissionAmount: { toString(): string }
      currency: string
    }) => ({
      saleRecordId: String(sale._id),
      sourceBatchId: sale.sourceBatchId,
      sourcePeriod: sourcePeriodsByBatchId.get(sale.sourceBatchId) || sale.sourceBatchId,
      soldAt: sale.soldAt,
      title: sale.title,
      quantity: sale.quantity,
      unit: sale.unit.toString(),
      discount: sale.discount.toString(),
      extended: sale.extended.toString(),
      grossAmount: sale.grossAmount.toString(),
      commissionAmount: sale.commissionAmount.toString(),
      currency: sale.currency
    }))
  }
})
