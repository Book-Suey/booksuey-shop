import mongoose from 'mongoose'

export interface IApprovedVendor {
  basilId: string
  lastName: string
  firstName: string
  phone?: string
  email: string
}

const ApprovedVendorSchema = new mongoose.Schema<IApprovedVendor>(
  {
    basilId: { type: String, required: true, unique: true },
    lastName: { type: String, required: true },
    firstName: { type: String, required: true },
    phone: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true }
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ApprovedVendor = mongoose.models.ApprovedVendor || mongoose.model<IApprovedVendor>('ApprovedVendor', ApprovedVendorSchema) as any
