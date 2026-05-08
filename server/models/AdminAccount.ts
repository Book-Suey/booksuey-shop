import type { Types } from 'mongoose'
import mongoose from 'mongoose'

export type AdminAccountStatus = 'active' | 'disabled'

export interface IAdminAccount {
  _id?: Types.ObjectId
  adminId: string
  displayName?: string
  email: string
  passwordHash: string
  status: AdminAccountStatus
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  failedLoginAttempts: number
  lockoutUntil?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date
}

const AdminAccountSchema = new mongoose.Schema<IAdminAccount>(
  {
    adminId: { type: String, required: true, unique: true },
    displayName: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      required: true
    },
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
export const AdminAccount = mongoose.models.AdminAccount || mongoose.model<IAdminAccount>('AdminAccount', AdminAccountSchema) as any
