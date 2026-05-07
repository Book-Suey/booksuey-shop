import crypto from 'crypto'
import Decimal from 'decimal.js'

function createPayoutError(statusCode: number, statusMessage: string): Error {
  const maybeCreateError = (globalThis as { createError?: (input: { statusCode: number, statusMessage: string }) => Error }).createError

  if (typeof maybeCreateError === 'function') {
    return maybeCreateError({ statusCode, statusMessage })
  }

  const error = new Error(statusMessage) as Error & { statusCode: number, statusMessage: string }
  error.statusCode = statusCode
  error.statusMessage = statusMessage
  return error
}

export const PAYOUT_REQUEST_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'disbursing',
  'paid',
  'failed'
] as const

export type PayoutRequestStatus = typeof PAYOUT_REQUEST_STATUSES[number]

const PAYOUT_STATUS_TRANSITIONS: Record<PayoutRequestStatus, PayoutRequestStatus[]> = {
  requested: ['approved', 'rejected', 'failed'],
  approved: ['disbursing', 'failed'],
  rejected: [],
  disbursing: ['paid', 'failed'],
  paid: [],
  failed: []
}

export function canTransitionPayoutRequestStatus(from: PayoutRequestStatus, to: PayoutRequestStatus): boolean {
  return PAYOUT_STATUS_TRANSITIONS[from].includes(to)
}

export function createPayoutRequestId(): string {
  return `payout_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

export function parsePositivePayoutAmount(value: unknown): Decimal {
  try {
    const amount = new Decimal(String(value))

    if (!amount.isFinite() || amount.lte(0)) {
      throw new Error('invalid')
    }

    return amount
  } catch {
    throw createPayoutError(400, 'PAYOUT_INVALID_AMOUNT: Requested amount must be greater than zero')
  }
}

export function formatUsdAmount(value: Decimal.Value): string {
  return new Decimal(value).toFixed(2)
}
