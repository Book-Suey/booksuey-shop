import mongoose from 'mongoose'

export type LedgerEntryType = 'sale' | 'reservation' | 'release' | 'paid' | 'opening_balance'

export interface ILedgerEntry {
  entryId: string
  vendorId?: string
  approvedVendorId: string
  entryType: LedgerEntryType
  amount: mongoose.Types.Decimal128
  currency: 'USD'
  referenceType: string
  referenceId: string
  occurredAt: Date
  description?: string
}

const LedgerEntrySchema = new mongoose.Schema<ILedgerEntry>(
  {
    entryId: { type: String, required: true, unique: true },
    vendorId: { type: String, index: true },
    approvedVendorId: {
      type: String,
      required: true,
      index: true,
      default(this: { vendorId?: string }) {
        return this.vendorId
      }
    },
    entryType: { type: String, enum: ['sale', 'reservation', 'release', 'paid', 'opening_balance'], required: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ['USD'], required: true, default: 'USD' },
    referenceType: { type: String, required: true },
    referenceId: { type: String, required: true },
    occurredAt: { type: Date, required: true },
    description: { type: String }
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

LedgerEntrySchema.index({ vendorId: 1, occurredAt: -1 })
LedgerEntrySchema.index({ approvedVendorId: 1, occurredAt: -1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const LedgerEntry = mongoose.models.LedgerEntry || mongoose.model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema) as any
