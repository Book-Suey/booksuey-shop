import type { Types } from 'mongoose'
import mongoose from 'mongoose'
import { PAYOUT_REQUEST_STATUSES } from '../utils/payouts'
import type { PayoutRequestStatus } from '../utils/payouts'

export interface IPayoutRequest {
  _id?: Types.ObjectId
  payoutRequestId: string
  vendorId: string
  amount: mongoose.Types.Decimal128
  currency: 'USD'
  status: PayoutRequestStatus
  requestedAt: Date
  approvedAt?: Date
  rejectedAt?: Date
  disbursingAt?: Date
  paidAt?: Date
  failedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const PayoutRequestSchema = new mongoose.Schema<IPayoutRequest>(
  {
    payoutRequestId: { type: String, required: true, unique: true },
    vendorId: { type: String, required: true, index: true },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ['USD'], required: true, default: 'USD' },
    status: { type: String, enum: PAYOUT_REQUEST_STATUSES, required: true, default: 'requested' },
    requestedAt: { type: Date, required: true },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    disbursingAt: { type: Date },
    paidAt: { type: Date },
    failedAt: { type: Date }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

PayoutRequestSchema.index({ vendorId: 1, createdAt: -1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PayoutRequest = mongoose.models.PayoutRequest || mongoose.model<IPayoutRequest>('PayoutRequest', PayoutRequestSchema) as any
