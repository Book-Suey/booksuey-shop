import type { PayPalPayoutItem } from './paypalClient'

export function normalizeVenmoHandle(handle: string): string {
  return handle.trim().replace(/^@/, '')
}

export function isValidVenmoHandle(handle: string): boolean {
  const normalized = normalizeVenmoHandle(handle)
  return /^[A-Za-z0-9](?:[A-Za-z0-9_-]{1,28}[A-Za-z0-9])?$/.test(normalized)
}

export function formatVenmoRecipient(input: {
  senderItemId: string
  venmoHandle: string
  amount: string
  note?: string
}): PayPalPayoutItem {
  const normalizedHandle = normalizeVenmoHandle(input.venmoHandle)

  if (!isValidVenmoHandle(normalizedHandle)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PAYOUT_INVALID_VENDOR_PROFILE: Venmo handle is invalid'
    })
  }

  return {
    recipientType: 'VENMO_ACCOUNT',
    receiver: normalizedHandle,
    recipientWallet: 'VENMO',
    senderItemId: input.senderItemId,
    note: input.note,
    amount: {
      value: input.amount,
      currency: 'USD'
    }
  }
}
