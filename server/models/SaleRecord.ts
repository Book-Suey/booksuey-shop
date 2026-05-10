import type { Types } from 'mongoose'
import mongoose from 'mongoose'

export interface ISaleRecord {
  _id?: Types.ObjectId
  vendorId?: string
  approvedVendorId: string
  sourceBatchId: string
  sourceRowKey: string
  soldAt: Date
  grossAmount: mongoose.Types.Decimal128
  commissionAmount: mongoose.Types.Decimal128
  currency: 'USD'
  title: string
  quantity: number
  unit: mongoose.Types.Decimal128
  discount: mongoose.Types.Decimal128
  extended: mongoose.Types.Decimal128
  cost: mongoose.Types.Decimal128
  credit: mongoose.Types.Decimal128
  saleOrderId: string
}

const SaleRecordSchema = new mongoose.Schema<ISaleRecord>(
  {
    vendorId: { type: String, index: true },
    approvedVendorId: {
      type: String,
      required: true,
      index: true,
      default(this: { vendorId?: string }) {
        return this.vendorId
      }
    },
    sourceBatchId: { type: String, required: true, index: true },
    sourceRowKey: { type: String, required: true, unique: true },
    soldAt: { type: Date, required: true },
    grossAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    commissionAmount: { type: mongoose.Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ['USD'], required: true, default: 'USD' },
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: mongoose.Schema.Types.Decimal128, required: true },
    discount: { type: mongoose.Schema.Types.Decimal128, required: true },
    extended: { type: mongoose.Schema.Types.Decimal128, required: true },
    cost: { type: mongoose.Schema.Types.Decimal128, required: true },
    credit: { type: mongoose.Schema.Types.Decimal128, required: true },
    saleOrderId: { type: String, required: true }
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

SaleRecordSchema.index({ vendorId: 1, soldAt: -1 })
SaleRecordSchema.index({ approvedVendorId: 1, soldAt: -1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SaleRecord = mongoose.models.SaleRecord || mongoose.model<ISaleRecord>('SaleRecord', SaleRecordSchema) as any

let saleRecordIndexesReady: Promise<void> | null = null

export async function ensureSaleRecordIndexes(): Promise<void> {
  if (!saleRecordIndexesReady) {
    saleRecordIndexesReady = (async () => {
      await SaleRecord.syncIndexes()
    })().catch((error: unknown) => {
      saleRecordIndexesReady = null
      throw error
    })
  }

  await saleRecordIndexesReady
}
