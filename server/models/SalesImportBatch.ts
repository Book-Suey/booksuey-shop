import mongoose from 'mongoose'

export type SalesImportBatchStatus = 'completed' | 'failed'

export interface ISalesImportError {
  code: string
  rowNumber: number
  reason: string
  hint: string
}

export type SalesImportDuplicateKind = 'within-upload' | 'existing-sale'
export type SalesImportManualImportStatus = 'not_requested' | 'requested' | 'imported'

export interface ISalesImportDuplicateDetail {
  rowNumber: number
  source: string
  saleOrderId: string
  title: string
  quantity: number
  unit: string
  discount: string
  extended: string
  cost: string
  credit: string
  soldAt: Date
  sourceRowKey: string
  duplicateKind: SalesImportDuplicateKind
  matchedRowNumber?: number
  existingBatchId?: string
  manualImportStatus: SalesImportManualImportStatus
  manualImportRequestedAt?: Date
  manualImportRequestedBy?: string
  manualImportImportedAt?: Date
  manualImportImportedBy?: string
  manualImportSaleRecordId?: string
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
  duplicateDetails: ISalesImportDuplicateDetail[]
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

const SalesImportDuplicateDetailSchema = new mongoose.Schema<ISalesImportDuplicateDetail>(
  {
    rowNumber: { type: Number, required: true },
    source: { type: String, required: true },
    saleOrderId: { type: String, required: true },
    title: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String, required: true },
    discount: { type: String, required: true },
    extended: { type: String, required: true },
    cost: { type: String, required: true },
    credit: { type: String, required: true },
    soldAt: { type: Date, required: true },
    sourceRowKey: { type: String, required: true },
    duplicateKind: {
      type: String,
      enum: ['within-upload', 'existing-sale'],
      required: true
    },
    matchedRowNumber: { type: Number },
    existingBatchId: { type: String },
    manualImportStatus: {
      type: String,
      enum: ['not_requested', 'requested', 'imported'],
      required: true,
      default: 'not_requested'
    },
    manualImportRequestedAt: { type: Date },
    manualImportRequestedBy: { type: String },
    manualImportImportedAt: { type: Date },
    manualImportImportedBy: { type: String },
    manualImportSaleRecordId: { type: String }
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
    duplicateDetails: { type: [SalesImportDuplicateDetailSchema], default: [] },
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
