import mongoose from 'mongoose'

export type DisbursementMethodType = 'paypal' | 'venmo'
export type DisbursementStatus = 'disbursing' | 'paid' | 'failed'

export interface IPaymentDisbursement {
  disbursementId: string
  payoutRequestId: string
  idempotencyKey: string
  methodType: DisbursementMethodType
  providerReferenceId: string
  providerItemId?: string
  amount: mongoose.Types.Decimal128
  currency: 'USD'
  status: DisbursementStatus
  disbursedAt: Date
  failureReason?: string
  createdAt: Date
  updatedAt: Date
}

const PaymentDisbursementSchema = new mongoose.Schema<IPaymentDisbursement>(
  {
    disbursementId: { type: String, required: true, unique: true },
    payoutRequestId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true },
    methodType: { type: String, enum: ['paypal', 'venmo'], required: true },
    providerReferenceId: { type: String, required: true },
    providerItemId: { type: String },
    amount: { type: mongoose.Schema.Types.Decimal128, required: true },
    currency: { type: String, enum: ['USD'], required: true, default: 'USD' },
    status: { type: String, enum: ['disbursing', 'paid', 'failed'], required: true },
    disbursedAt: { type: Date, required: true },
    failureReason: { type: String }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

PaymentDisbursementSchema.index({ payoutRequestId: 1, idempotencyKey: 1 }, { unique: true })
PaymentDisbursementSchema.index({ providerItemId: 1 }, { unique: true, sparse: true })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const PaymentDisbursement = mongoose.models.PaymentDisbursement || mongoose.model<IPaymentDisbursement>('PaymentDisbursement', PaymentDisbursementSchema) as any
