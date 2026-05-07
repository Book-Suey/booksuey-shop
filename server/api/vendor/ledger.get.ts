import mongoose from 'mongoose'
import { connectToDatabase } from '../../config/database'
import { LedgerEntry } from '../../models/LedgerEntry'
import { SaleRecord } from '../../models/SaleRecord'
import { getLedgerEntryBalanceImpact } from '../../utils/balance'
import { requireVendorId } from '../../utils/vendorContext'

type SaleLedgerReference = {
  soldAt: Date
  title: string
  quantity: number
  unit: { toString(): string }
  discount: { toString(): string }
  extended: { toString(): string }
}

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorId = requireVendorId(event)
  const entries = await LedgerEntry.find({ vendorId }).sort({ occurredAt: 1, _id: 1 })
  const saleRecordIds = entries
    .filter((entry: { referenceType: string, referenceId: string }) => entry.referenceType === 'SaleRecord' && mongoose.Types.ObjectId.isValid(entry.referenceId))
    .map((entry: { referenceId: string }) => new mongoose.Types.ObjectId(entry.referenceId))

  const saleRecords = saleRecordIds.length > 0
    ? await SaleRecord.find({ _id: { $in: saleRecordIds } })
    : []

  const saleRecordById = new Map<string, SaleLedgerReference>(saleRecords.map((sale: {
    _id: mongoose.Types.ObjectId
    soldAt: Date
    title: string
    quantity: number
    unit: { toString(): string }
    discount: { toString(): string }
    extended: { toString(): string }
  }) => [String(sale._id), sale] as const))

  return {
    ledgerEntries: entries.map((entry: {
      entryId: string
      entryType: 'sale' | 'reservation' | 'release' | 'paid'
      amount: { toString(): string }
      currency: string
      referenceType: string
      referenceId: string
      occurredAt: Date
    }) => {
      const saleRecord = saleRecordById.get(entry.referenceId)

      return {
        entryId: entry.entryId,
        entryType: entry.entryType,
        amount: entry.amount.toString(),
        balanceImpact: getLedgerEntryBalanceImpact(entry.entryType, entry.amount.toString()),
        currency: entry.currency,
        occurredAt: entry.occurredAt,
        reference: {
          referenceType: entry.referenceType,
          referenceId: entry.referenceId,
          ...(saleRecord
            ? {
                sale: {
                  soldAt: saleRecord.soldAt,
                  title: saleRecord.title,
                  quantity: saleRecord.quantity,
                  unit: saleRecord.unit.toString(),
                  discount: saleRecord.discount.toString(),
                  extended: saleRecord.extended.toString()
                }
              }
            : {})
        }
      }
    })
  }
})
