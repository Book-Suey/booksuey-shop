import type { IVendor } from '../models/Vendor'
import { createBatchPayout } from './paypalClient'
import { formatVenmoRecipient } from './venmoHandler'

export interface PayoutMethodMapping {
  type: 'paypal' | 'venmo'
  recipient: string
  displayLabel: string
}

export interface ExecutePayoutInput {
  disbursementId: string
  idempotencyKey: string
  amount: string
  currency: 'USD'
  vendor: Pick<IVendor, 'vendorId' | 'displayName' | 'legalName' | 'preferredPayoutMethod' | 'paypalEmail' | 'venmoHandle'>
  methodTypeOverride?: 'paypal' | 'venmo'
}

export interface ExecutePayoutResult {
  methodType: 'paypal' | 'venmo'
  paypalBatchId: string
  providerItemId?: string
  providerTransferId?: string
  providerStatus?: string
}

export function mapVendorToPayout(input: {
  vendor: Pick<IVendor, 'preferredPayoutMethod' | 'paypalEmail' | 'venmoHandle'>
  methodTypeOverride?: 'paypal' | 'venmo'
}): PayoutMethodMapping {
  const requestedMethod = input.methodTypeOverride || input.vendor.preferredPayoutMethod

  if (requestedMethod === 'venmo') {
    const venmoHandle = input.vendor.venmoHandle?.trim()
    if (!venmoHandle) {
      throw createError({
        statusCode: 400,
        statusMessage: 'PAYOUT_INVALID_VENDOR_PROFILE: Missing Venmo handle for selected payout method'
      })
    }

    return {
      type: 'venmo',
      recipient: venmoHandle,
      displayLabel: venmoHandle
    }
  }

  if (requestedMethod === 'paypal') {
    const paypalEmail = input.vendor.paypalEmail?.trim().toLowerCase()
    if (!paypalEmail) {
      throw createError({
        statusCode: 400,
        statusMessage: 'PAYOUT_INVALID_VENDOR_PROFILE: Missing PayPal email for selected payout method'
      })
    }

    return {
      type: 'paypal',
      recipient: paypalEmail,
      displayLabel: paypalEmail
    }
  }

  const fallbackPayPal = input.vendor.paypalEmail?.trim().toLowerCase()
  if (fallbackPayPal) {
    return {
      type: 'paypal',
      recipient: fallbackPayPal,
      displayLabel: fallbackPayPal
    }
  }

  const fallbackVenmo = input.vendor.venmoHandle?.trim()
  if (fallbackVenmo) {
    return {
      type: 'venmo',
      recipient: fallbackVenmo,
      displayLabel: fallbackVenmo
    }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'PAYOUT_INVALID_VENDOR_PROFILE: Vendor has no configured payout recipient'
  })
}

export async function executePayout(input: ExecutePayoutInput): Promise<ExecutePayoutResult> {
  if (input.currency !== 'USD') {
    throw createError({
      statusCode: 400,
      statusMessage: 'PAYOUT_UNSUPPORTED_CURRENCY: Only USD payouts are currently supported'
    })
  }

  const mapping = mapVendorToPayout({
    vendor: input.vendor,
    methodTypeOverride: input.methodTypeOverride
  })

  const senderDisplayName = input.vendor.displayName || input.vendor.legalName || input.vendor.vendorId
  const payoutItem
    = mapping.type === 'venmo'
      ? formatVenmoRecipient({
          senderItemId: input.disbursementId,
          venmoHandle: mapping.recipient,
          amount: input.amount,
          note: `Book Suey payout for ${senderDisplayName}`
        })
      : {
          recipientType: 'EMAIL' as const,
          receiver: mapping.recipient,
          senderItemId: input.disbursementId,
          note: `Book Suey payout for ${senderDisplayName}`,
          amount: {
            value: input.amount,
            currency: 'USD' as const
          }
        }

  const payoutResult = await createBatchPayout({
    senderBatchId: input.idempotencyKey,
    emailSubject: 'You have a payout from Book Suey',
    emailMessage: 'Your payout has been initiated and will complete shortly.',
    items: [payoutItem]
  })

  const matchedItem = payoutResult.items.find(item => item.senderItemId === input.disbursementId)

  return {
    methodType: mapping.type,
    paypalBatchId: payoutResult.batchId,
    providerItemId: matchedItem?.payoutItemId,
    providerTransferId: matchedItem?.transactionId,
    providerStatus: matchedItem?.transactionStatus || payoutResult.batchStatus
  }
}
