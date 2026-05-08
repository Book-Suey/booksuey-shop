import mongoose from 'mongoose'

export type SalesImportBatchStatus = 'completed' | 'failed'

export interface ISalesImportError {
  code: string
  rowNumber: number
  reason: string
  hint: string
}

export interface ISalesImportBatch {
  batchId: string
  sourcePeriod: string
  uploadedBy: string
  uploadedAt: Date
  status: SalesImportBatchStatus
  checksum: string
  idempotencyKey: string
  totalRows: number
  acceptedRows: number
  rejectedRows: number
  nonVendorRejectedRows: number
  duplicateRows: number
  errors: ISalesImportError[]
  unmappedSources: string[]
  nonVendorSources: string[]
}

const SalesImportErrorSchema = new mongoose.Schema<ISalesImportError>(
  {
    code: { type: String, required: true },
    rowNumber: { type: Number, required: true },
    reason: { type: String, required: true },
    hint: { type: String, required: true }
  },
  { _id: false }
)

const SalesImportBatchSchema = new mongoose.Schema<ISalesImportBatch>(
  {
    batchId: { type: String, required: true, unique: true },
    sourcePeriod: { type: String, required: true },
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['completed', 'failed'], required: true },
    checksum: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    totalRows: { type: Number, required: true },
    acceptedRows: { type: Number, required: true },
    rejectedRows: { type: Number, required: true },
    nonVendorRejectedRows: { type: Number, required: true, default: 0 },
    duplicateRows: { type: Number, required: true },
    errors: { type: [SalesImportErrorSchema], default: [] },
    unmappedSources: { type: [String], default: [] },
    nonVendorSources: { type: [String], default: [] }
  },
  {
    // `errors` is intentionally part of the import summary contract.
    suppressReservedKeysWarning: true,
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

SalesImportBatchSchema.index({ sourcePeriod: 1, uploadedAt: -1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SalesImportBatch = mongoose.models.SalesImportBatch || mongoose.model<ISalesImportBatch>('SalesImportBatch', SalesImportBatchSchema) as any
