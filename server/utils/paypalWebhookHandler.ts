import { PaymentDisbursement } from '../models/PaymentDisbursement'
import { ProcessedWebhookEvent } from '../models/ProcessedWebhookEvent'
import { PayoutRequest } from '../models/PayoutRequest'
import { settleDisbursementFailed, settleDisbursementPaid } from './disbursementSettlement'

type PayPalWebhookResource = {
  payout_batch_id?: string
  payout_item_id?: string
  transaction_id?: string
  transaction_status?: string
  errors?: {
    name?: string
    message?: string
  }
  sender_item_id?: string
}

type PayPalWebhookEvent = {
  id?: string
  event_type?: string
  create_time?: string
  resource?: PayPalWebhookResource
}

type CanonicalPayoutEventType
  = | 'PAYOUT.ITEM.SUCCEEDED'
    | 'PAYOUT.ITEM.FAILED'
    | 'PAYOUT.ITEM.RETURNED'
    | 'PAYOUT.ITEM.UNCLAIMED'

function toCanonicalPayoutEventType(eventType: string | undefined): CanonicalPayoutEventType | null {
  if (!eventType) {
    return null
  }

  const normalized = eventType.trim().toUpperCase()

  const aliasMap: Record<string, CanonicalPayoutEventType> = {
    'PAYOUT.ITEM.SUCCEEDED': 'PAYOUT.ITEM.SUCCEEDED',
    'PAYOUT.ITEM.FAILED': 'PAYOUT.ITEM.FAILED',
    'PAYOUT.ITEM.RETURNED': 'PAYOUT.ITEM.RETURNED',
    'PAYOUT.ITEM.UNCLAIMED': 'PAYOUT.ITEM.UNCLAIMED',
    'PAYMENT.PAYOUTS-ITEM.SUCCEEDED': 'PAYOUT.ITEM.SUCCEEDED',
    'PAYMENT.PAYOUTS-ITEM.FAILED': 'PAYOUT.ITEM.FAILED',
    'PAYMENT.PAYOUTS-ITEM.RETURNED': 'PAYOUT.ITEM.RETURNED',
    'PAYMENT.PAYOUTS-ITEM.UNCLAIMED': 'PAYOUT.ITEM.UNCLAIMED',
    'PAYMENT.PAYOUTS_ITEM.SUCCEEDED': 'PAYOUT.ITEM.SUCCEEDED',
    'PAYMENT.PAYOUTS_ITEM.FAILED': 'PAYOUT.ITEM.FAILED',
    'PAYMENT.PAYOUTS_ITEM.RETURNED': 'PAYOUT.ITEM.RETURNED',
    'PAYMENT.PAYOUTS_ITEM.UNCLAIMED': 'PAYOUT.ITEM.UNCLAIMED'
  }

  return aliasMap[normalized] || null
}

function resolveFailureReason(resource?: PayPalWebhookResource): string {
  if (!resource) {
    return 'Payout failed at provider'
  }

  const providerMessage = [resource.errors?.name, resource.errors?.message]
    .filter(Boolean)
    .join(': ')
    .trim()

  if (providerMessage) {
    return providerMessage
  }

  if (resource.transaction_status) {
    return `PayPal status: ${resource.transaction_status}`
  }

  return 'Payout failed at provider'
}

function resolveEventDate(event: PayPalWebhookEvent): Date {
  const timestamp = event.create_time ? Date.parse(event.create_time) : Number.NaN
  return Number.isFinite(timestamp) ? new Date(timestamp) : new Date()
}

async function ensureWebhookNotProcessed(event: PayPalWebhookEvent): Promise<boolean> {
  if (!event.id) {
    return true
  }

  const existing = await ProcessedWebhookEvent.findOne({
    provider: 'paypal',
    webhookEventId: event.id
  })

  if (existing) {
    return false
  }

  await ProcessedWebhookEvent.create({
    provider: 'paypal',
    webhookEventId: event.id,
    eventType: event.event_type || 'unknown',
    processedAt: new Date()
  })

  return true
}

async function findDisbursementForWebhook(resource?: PayPalWebhookResource): Promise<null | {
  disbursementId: string
  payoutRequestId: string
  vendorId: string
  amount: string
}> {
  if (!resource) {
    return null
  }

  const byItemId = resource.payout_item_id
    ? await PaymentDisbursement.findOne({ providerItemId: resource.payout_item_id })
    : null

  const byTransferId = !byItemId && resource.transaction_id
    ? await PaymentDisbursement.findOne({ providerItemId: resource.transaction_id })
    : null

  const bySenderId = !byItemId && !byTransferId && resource.sender_item_id
    ? await PaymentDisbursement.findOne({ disbursementId: resource.sender_item_id })
    : null

  const byBatchId = !byItemId && !byTransferId && !bySenderId && resource.payout_batch_id
    ? await PaymentDisbursement.findOne({ providerReferenceId: resource.payout_batch_id }).sort({ createdAt: -1, _id: -1 })
    : null

  const disbursement = byItemId || byTransferId || bySenderId || byBatchId
  if (!disbursement) {
    return null
  }

  const payoutRequest = await PayoutRequest.findOne({ payoutRequestId: disbursement.payoutRequestId })
  if (!payoutRequest) {
    return null
  }

  return {
    disbursementId: disbursement.disbursementId,
    payoutRequestId: payoutRequest.payoutRequestId,
    vendorId: payoutRequest.vendorId,
    amount: payoutRequest.amount.toString()
  }
}

export async function handlePayPalEvent(rawEvent: unknown): Promise<void> {
  const event = rawEvent as PayPalWebhookEvent
  const canonicalEventType = toCanonicalPayoutEventType(event.event_type)

  if (!canonicalEventType) {
    return
  }

  const canProcess = await ensureWebhookNotProcessed(event)
  if (!canProcess) {
    return
  }

  const disbursement = await findDisbursementForWebhook(event.resource)
  if (!disbursement) {
    return
  }

  const occurredAt = resolveEventDate(event)

  if (canonicalEventType === 'PAYOUT.ITEM.SUCCEEDED') {
    await settleDisbursementPaid({
      ...disbursement,
      occurredAt,
      actorId: 'system:paypal-webhook'
    })
    return
  }

  await settleDisbursementFailed({
    ...disbursement,
    occurredAt,
    actorId: 'system:paypal-webhook',
    failureReason: resolveFailureReason(event.resource)
  })
}
