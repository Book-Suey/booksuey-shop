type PayPalEnvironment = 'sandbox' | 'live'

interface PayPalConfig {
  clientId: string
  clientSecret: string
  environment: PayPalEnvironment
  baseUrl: string
  webhookId?: string
}

interface AccessTokenCache {
  accessToken: string
  expiresAt: number
}

export interface PayPalPayoutItem {
  recipientType: 'EMAIL' | 'VENMO_ACCOUNT'
  amount: {
    value: string
    currency: 'USD'
  }
  note?: string
  senderItemId: string
  receiver: string
  recipientWallet?: 'VENMO'
}

export interface CreateBatchPayoutInput {
  senderBatchId: string
  emailSubject: string
  emailMessage?: string
  items: PayPalPayoutItem[]
}

export interface PayPalPayoutCreateResult {
  batchId: string
  batchStatus?: string
  items: Array<{
    senderItemId?: string
    payoutItemId?: string
    transactionId?: string
    transactionStatus?: string
  }>
}

let accessTokenCache: AccessTokenCache | null = null

function createPayPalError(statusCode: number, statusMessage: string): Error {
  const maybeCreateError = (globalThis as { createError?: (input: { statusCode: number, statusMessage: string }) => Error }).createError

  if (typeof maybeCreateError === 'function') {
    return maybeCreateError({ statusCode, statusMessage })
  }

  const error = new Error(statusMessage) as Error & { statusCode: number, statusMessage: string }
  error.statusCode = statusCode
  error.statusMessage = statusMessage
  return error
}

function resolvePayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim()
  const environment = (process.env.PAYPAL_ENVIRONMENT?.trim().toLowerCase() || 'sandbox') as PayPalEnvironment

  if (!clientId || !clientSecret) {
    throw createPayPalError(500, 'PAYPAL_NOT_CONFIGURED: Missing PayPal credentials')
  }

  if (environment !== 'sandbox' && environment !== 'live') {
    throw createPayPalError(500, 'PAYPAL_NOT_CONFIGURED: PAYPAL_ENVIRONMENT must be sandbox or live')
  }

  return {
    clientId,
    clientSecret,
    environment,
    webhookId,
    baseUrl: environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function stringifyErrorBody(body: unknown): string {
  if (typeof body === 'string') {
    return body
  }

  try {
    return JSON.stringify(body)
  } catch {
    return String(body)
  }
}

export function clearPayPalTokenCache(): void {
  accessTokenCache = null
}

export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && accessTokenCache && Date.now() < accessTokenCache.expiresAt - 15_000) {
    return accessTokenCache.accessToken
  }

  const config = resolvePayPalConfig()
  const encodedCredentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
  const body = new URLSearchParams()
  body.set('grant_type', 'client_credentials')

  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'authorization': `Basic ${encodedCredentials}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  })

  const responseBody = await parseResponseBody(response) as { access_token?: string, expires_in?: number, error_description?: string }

  if (!response.ok || !responseBody?.access_token || !responseBody.expires_in) {
    throw createPayPalError(
      502,
      `PAYPAL_TOKEN_FAILED: ${responseBody?.error_description || stringifyErrorBody(responseBody)}`
    )
  }

  accessTokenCache = {
    accessToken: responseBody.access_token,
    expiresAt: Date.now() + (responseBody.expires_in * 1000)
  }

  return responseBody.access_token
}

export async function createBatchPayout(input: CreateBatchPayoutInput): Promise<PayPalPayoutCreateResult> {
  const config = resolvePayPalConfig()
  const accessToken = await getAccessToken()

  const response = await fetch(`${config.baseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'paypal-request-id': input.senderBatchId
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: input.senderBatchId,
        email_subject: input.emailSubject,
        email_message: input.emailMessage
      },
      items: input.items.map(item => ({
        recipient_type: item.recipientType,
        amount: item.amount,
        note: item.note,
        sender_item_id: item.senderItemId,
        receiver: item.receiver,
        recipient_wallet: item.recipientWallet
      }))
    })
  })

  const responseBody = await parseResponseBody(response) as {
    name?: string
    message?: string
    details?: Array<{ issue?: string, description?: string }>
    batch_header?: { payout_batch_id?: string, batch_status?: string }
    items?: Array<{
      sender_item_id?: string
      payout_item_id?: string
      transaction_id?: string
      transaction_status?: string
    }>
  }

  if (!response.ok || !responseBody?.batch_header?.payout_batch_id) {
    const details = responseBody?.details?.map(detail => detail.description || detail.issue).filter(Boolean).join('; ')
    throw createPayPalError(
      502,
      `PAYPAL_PAYOUT_FAILED: ${details || responseBody?.message || responseBody?.name || stringifyErrorBody(responseBody)}`
    )
  }

  return {
    batchId: responseBody.batch_header.payout_batch_id,
    batchStatus: responseBody.batch_header.batch_status,
    items: (responseBody.items || []).map(item => ({
      senderItemId: item.sender_item_id,
      payoutItemId: item.payout_item_id,
      transactionId: item.transaction_id,
      transactionStatus: item.transaction_status
    }))
  }
}

export async function getBatchStatus(batchId: string): Promise<unknown> {
  const config = resolvePayPalConfig()
  const accessToken = await getAccessToken()

  const response = await fetch(`${config.baseUrl}/v1/payments/payouts/${batchId}`, {
    method: 'GET',
    headers: {
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json'
    }
  })

  const responseBody = await parseResponseBody(response)

  if (!response.ok) {
    throw createPayPalError(502, `PAYPAL_BATCH_LOOKUP_FAILED: ${stringifyErrorBody(responseBody)}`)
  }

  return responseBody
}

export async function verifyWebhookSignature(input: {
  transmissionId: string
  transmissionTime: string
  transmissionSignature: string
  certUrl: string
  authAlgo: string
  webhookEvent: unknown
}): Promise<boolean> {
  const config = resolvePayPalConfig()
  if (!config.webhookId) {
    throw createPayPalError(500, 'PAYPAL_NOT_CONFIGURED: Missing PAYPAL_WEBHOOK_ID')
  }

  const accessToken = await getAccessToken()

  const response = await fetch(`${config.baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      auth_algo: input.authAlgo,
      cert_url: input.certUrl,
      transmission_id: input.transmissionId,
      transmission_sig: input.transmissionSignature,
      transmission_time: input.transmissionTime,
      webhook_id: config.webhookId,
      webhook_event: input.webhookEvent
    })
  })

  const responseBody = await parseResponseBody(response) as { verification_status?: string }

  if (!response.ok) {
    throw createPayPalError(502, `PAYPAL_WEBHOOK_VERIFY_FAILED: ${stringifyErrorBody(responseBody)}`)
  }

  return responseBody?.verification_status === 'SUCCESS'
}
