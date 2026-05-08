import mongoose from 'mongoose'

export interface IVerifiedNonVendorSource {
  sourceName: string
  normalizedSource: string
  createdAt: Date
  updatedAt: Date
}

const VerifiedNonVendorSourceSchema = new mongoose.Schema<IVerifiedNonVendorSource>(
  {
    sourceName: { type: String, required: true },
    normalizedSource: { type: String, required: true, unique: true }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

VerifiedNonVendorSourceSchema.index({ sourceName: 1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VerifiedNonVendorSource = mongoose.models.VerifiedNonVendorSource || mongoose.model<IVerifiedNonVendorSource>('VerifiedNonVendorSource', VerifiedNonVendorSourceSchema) as any
