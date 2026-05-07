import mongoose from 'mongoose'

export type LedgerEntryType = 'sale' | 'reservation' | 'release' | 'paid'

export interface ILedgerEntry {
  entryId: string
  vendorId: string
  entryType: LedgerEntryType
  amount: mongoose.Types.Decimal128
  currency: 'USD'
  referenceType: string
  referenceId: string
  occurredAt: Date
}

const LedgerEntrySchema = new mongoose.Schema<ILedgerEntry>(
  {
    entryId: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    entryType: { type: String, enum: ['sale', 'reservation', 'release', 'paid'], required: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ['USD'], required: true, default: 'USD' },
    referenceType: { type: String, required: true },
    referenceId: { type: String, required: true },
    occurredAt: { type: Date, required: true }
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

LedgerEntrySchema.index({ vendorId: 1, occurredAt: -1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LedgerEntry = mongoose.models.LedgerEntry || mongoose.model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema) as any
