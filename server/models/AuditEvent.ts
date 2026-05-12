import mongoose from 'mongoose'

export type ActorRole = 'admin' | 'vendor'

export type AuditAction
  = | 'vendor_registered'
    | 'admin_login'
    | 'vendor_created'
    | 'vendor_invited'
    | 'vendor_login'
    | 'vendor_logout'
    | 'password_reset_requested'
    | 'password_reset_completed'
    | 'vendor_updated'
    | 'approved_vendor_created'
    | 'approved_vendor_updated'
    | 'approved_vendor_deleted'
    | 'payout_requested'
    | 'payout_approved'
    | 'payout_rejected'
    | 'disbursement_created'
    | 'disbursement_completed'
    | 'disbursement_failed'
    | 'sales_imported'
    | 'sales_duplicate_manual_import_requested'
    | 'sales_duplicate_imported'

export interface IAuditEvent {
  auditEventId: string
  actorId: string
  actorRole: ActorRole
  action: AuditAction
  entityType: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  createdAt: Date
}

const AuditEventSchema = new mongoose.Schema<IAuditEvent>(
  {
    auditEventId: { type: String, required: true, unique: true },
    actorId: { type: String, required: true },
    actorRole: { type: String, enum: ['admin', 'vendor'], required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now, required: true }
  },
  {
    capped: { size: 1024 * 1024 * 100, max: 100000 }, // 100MB cap, 100k docs max
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

AuditEventSchema.index({ actorId: 1, createdAt: -1 })
AuditEventSchema.index({ action: 1, createdAt: -1 })
AuditEventSchema.index({ entityType: 1, entityId: 1 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const AuditEvent = mongoose.models.AuditEvent || mongoose.model<IAuditEvent>('AuditEvent', AuditEventSchema) as any
