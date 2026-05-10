import type { Types } from 'mongoose'
import mongoose from 'mongoose'

export interface IProcessedWebhookEvent {
  _id?: Types.ObjectId
  provider: 'paypal'
  webhookEventId: string
  eventType: string
  processedAt: Date
  createdAt: Date
  updatedAt: Date
}

const ProcessedWebhookEventSchema = new mongoose.Schema<IProcessedWebhookEvent>(
  {
    provider: { type: String, enum: ['paypal'], required: true, default: 'paypal' },
    webhookEventId: { type: String, required: true },
    eventType: { type: String, required: true },
    processedAt: { type: Date, required: true, default: Date.now }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
)

ProcessedWebhookEventSchema.index({ provider: 1, webhookEventId: 1 }, { unique: true })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ProcessedWebhookEvent = mongoose.models.ProcessedWebhookEvent || mongoose.model<IProcessedWebhookEvent>('ProcessedWebhookEvent', ProcessedWebhookEventSchema) as any
