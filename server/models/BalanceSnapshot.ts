import mongoose from 'mongoose'

export interface IBalanceSnapshot {
  vendorId: string
  pendingAmount: mongoose.Types.Decimal128
  availableAmount: mongoose.Types.Decimal128
  paidAmount: mongoose.Types.Decimal128
  asOf: Date
}

const BalanceSnapshotSchema = new mongoose.Schema<IBalanceSnapshot>(
  {
    vendorId: { type: String, required: true, unique: true },
    pendingAmount: { type: mongoose.Schema.Types.Decimal128, required: true, default: '0' },
    availableAmount: { type: mongoose.Schema.Types.Decimal128, required: true, default: '0' },
    paidAmount: { type: mongoose.Schema.Types.Decimal128, required: true, default: '0' },
    asOf: { type: Date, required: true, default: Date.now }
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BalanceSnapshot = mongoose.models.BalanceSnapshot || mongoose.model<IBalanceSnapshot>('BalanceSnapshot', BalanceSnapshotSchema) as any
