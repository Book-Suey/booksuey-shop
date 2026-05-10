import type { Types } from 'mongoose'
import mongoose from 'mongoose'

export type VendorStatus = 'active' | 'inactive'
export type VendorPayoutMethod = 'paypal' | 'venmo'

export interface IVendor {
  _id?: Types.ObjectId
  vendorId: string
  legalName: string
  displayName: string
  email: string
  phone?: string
  preferredPayoutMethod?: VendorPayoutMethod
  payoutRecipientName?: string
  paypalEmail?: string
  venmoHandle?: string
  passwordHash: string
  status: VendorStatus
  approvedVendorId?: string
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  failedLoginAttempts: number
  lockoutUntil?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
}

const VendorSchema = new mongoose.Schema<IVendor>(
  {
    vendorId: { type: String, required: true, unique: true },
    legalName: { type: String, required: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String },
    preferredPayoutMethod: {
      type: String,
      enum: ['paypal', 'venmo']
    },
    payoutRecipientName: { type: String },
    paypalEmail: { type: String, lowercase: true },
    venmoHandle: { type: String },
    passwordHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      required: true
    },
    approvedVendorId: { type: String },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const Vendor = mongoose.models.Vendor || mongoose.model<IVendor>('Vendor', VendorSchema) as any
