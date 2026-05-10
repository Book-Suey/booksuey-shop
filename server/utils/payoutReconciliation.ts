import { PaymentDisbursement } from '../models/PaymentDisbursement'
import { PayoutRequest } from '../models/PayoutRequest'
import { getBatchStatus } from './paypalClient'
import { settleDisbursementFailed, settleDisbursementPaid } from './disbursementSettlement'

type LocalDisbursementStatus = 'disbursing' | 'paid' | 'failed'

type PayPalPayoutBatchResponse = {
  items?: Array<{
    payout_item_id?: string
    sender_item_id?: string
    transaction_id?: string
    transaction_status?: string
    payout_item_fee?: unknown
    errors?: {
      name?: string
      message?: string
    }
  }>
}

export interface ReconciledDisbursementResult {
  disbursementId: string
  payoutRequestId: string
  providerReferenceId: string
  providerItemId?: string
  remoteStatus: string
  localStatusBefore: LocalDisbursementStatus
  localStatusAfter: LocalDisbursementStatus
  changed: boolean
  failureReason?: string
}

function mapProviderStatusToLocal(providerStatus: string | undefined): LocalDisbursementStatus {
  const normalized = (providerStatus || '').trim().toUpperCase()

  if (['SUCCESS', 'COMPLETED', 'PAID'].includes(normalized)) {
    return 'paid'
  }

  if (['FAILED', 'RETURNED', 'DENIED', 'REFUNDED', 'BLOCKED', 'REVERSED'].includes(normalized)) {
    return 'failed'
  }

  return 'disbursing'
}

function resolveFailureReason(item: { errors?: { name?: string, message?: string }, transaction_status?: string }): string {
  const errorSummary = [item.errors?.name, item.errors?.message]
    .filter(Boolean)
    .join(': ')
    .trim()

  if (errorSummary) {
    return errorSummary
  }

  if (item.transaction_status) {
    return `PayPal status: ${item.transaction_status}`
  }

  return 'Provider reported payout failure'
}

function selectProviderItem(
  items: Array<{ payout_item_id?: string, sender_item_id?: string, transaction_id?: string, transaction_status?: string, errors?: { name?: string, message?: string } }>,
  disbursementId: string,
  providerItemId?: string
): { payout_item_id?: string, sender_item_id?: string, transaction_id?: string, transaction_status?: string, errors?: { name?: string, message?: string } } | null {
  if (items.length === 0) {
    return null
  }

  if (providerItemId) {
    const byKnownProviderItem = items.find(item => item.payout_item_id === providerItemId || item.transaction_id === providerItemId)
    if (byKnownProviderItem) {
      return byKnownProviderItem
    }
  }

  const bySenderItemId = items.find(item => item.sender_item_id === disbursementId)
  if (bySenderItemId) {
    return bySenderItemId
  }

  if (items.length === 1) {
    return items[0] || null
  }

  return null
}

export async function checkPayoutStatus(input: {
  disbursementId: string
  payoutRequestId: string
  providerReferenceId: string
  providerItemId?: string
  localStatus: LocalDisbursementStatus
  actorId?: string
}): Promise<ReconciledDisbursementResult> {
  const actorId = input.actorId || 'system:paypal-reconciliation'
  const batchResponse = await getBatchStatus(input.providerReferenceId) as PayPalPayoutBatchResponse
  const items = batchResponse.items || []

  const selectedItem = selectProviderItem(items, input.disbursementId, input.providerItemId)
  const providerStatus = selectedItem?.transaction_status || 'UNKNOWN'
  const nextStatus = mapProviderStatusToLocal(selectedItem?.transaction_status)

  const payoutRequest = await PayoutRequest.findOne({ payoutRequestId: input.payoutRequestId })
  if (!payoutRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Payout request not found during reconciliation'
    })
  }

  if (nextStatus === 'paid') {
    await settleDisbursementPaid({
      disbursementId: input.disbursementId,
      payoutRequestId: input.payoutRequestId,
      vendorId: payoutRequest.vendorId,
      amount: payoutRequest.amount.toString(),
      occurredAt: new Date(),
      actorId
    })
  }

  if (nextStatus === 'failed') {
    await settleDisbursementFailed({
      disbursementId: input.disbursementId,
      payoutRequestId: input.payoutRequestId,
      vendorId: payoutRequest.vendorId,
      amount: payoutRequest.amount.toString(),
      occurredAt: new Date(),
      actorId,
      failureReason: resolveFailureReason(selectedItem || {})
    })
  }

  await PaymentDisbursement.updateOne(
    { disbursementId: input.disbursementId },
    {
      $set: {
        providerItemId: selectedItem?.payout_item_id || selectedItem?.transaction_id || input.providerItemId
      }
    }
  )

  return {
    disbursementId: input.disbursementId,
    payoutRequestId: input.payoutRequestId,
    providerReferenceId: input.providerReferenceId,
    providerItemId: selectedItem?.payout_item_id || selectedItem?.transaction_id || input.providerItemId,
    remoteStatus: providerStatus,
    localStatusBefore: input.localStatus,
    localStatusAfter: nextStatus,
    changed: input.localStatus !== nextStatus,
    failureReason: nextStatus === 'failed' ? resolveFailureReason(selectedItem || {}) : undefined
  }
}

export async function reconcileOutstandingPayouts(input?: {
  payoutRequestId?: string
  disbursementId?: string
  limit?: number
  actorId?: string
}): Promise<ReconciledDisbursementResult[]> {
  const query: {
    status: 'disbursing'
    payoutRequestId?: string
    disbursementId?: string
  } = {
    status: 'disbursing'
  }

  if (input?.payoutRequestId) {
    query.payoutRequestId = input.payoutRequestId
  }

  if (input?.disbursementId) {
    query.disbursementId = input.disbursementId
  }

  const limit = input?.limit ?? 100
  const disbursements = await PaymentDisbursement.find(query)
    .sort({ updatedAt: 1, _id: 1 })
    .limit(limit)

  const results: ReconciledDisbursementResult[] = []

  for (const disbursement of disbursements) {
    const result = await checkPayoutStatus({
      disbursementId: disbursement.disbursementId,
      payoutRequestId: disbursement.payoutRequestId,
      providerReferenceId: disbursement.providerReferenceId,
      providerItemId: disbursement.providerItemId,
      localStatus: disbursement.status,
      actorId: input?.actorId || 'system:paypal-reconciliation'
    })

    results.push(result)
  }

  return results
}
