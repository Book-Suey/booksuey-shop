interface SendEmailInput {
  to: string
  subject: string
  text: string
  html?: string
}

interface EmailDeliveryResult {
  delivered: boolean
  skippedReason?: string
}

function getAppBaseUrl(): string {
  const configuredBaseUrl = process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL

  if (!configuredBaseUrl) {
    return 'http://localhost:3000'
  }

  return configuredBaseUrl.replace(/\/$/, '')
}

function resolveMailgunConfig(): {
  apiKey: string
  domain: string
  fromEmail: string
} | null {
  const apiKey = process.env.MAILGUN_API_KEY
  const domain = process.env.MAILGUN_DOMAIN
  const fromEmail = process.env.MAILGUN_FROM_EMAIL || `Book Suey <no-reply@${domain || 'example.com'}>`

  if (!apiKey || !domain) {
    return null
  }

  return {
    apiKey,
    domain,
    fromEmail
  }
}

export function buildAbsoluteAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getAppBaseUrl()}${normalizedPath}`
}

export async function sendEmailViaMailgun(input: SendEmailInput): Promise<EmailDeliveryResult> {
  const mailgunConfig = resolveMailgunConfig()

  if (!mailgunConfig) {
    return {
      delivered: false,
      skippedReason: 'Mailgun is not configured'
    }
  }

  const payload = new URLSearchParams()
  payload.set('from', mailgunConfig.fromEmail)
  payload.set('to', input.to)
  payload.set('subject', input.subject)
  payload.set('text', input.text)

  if (input.html) {
    payload.set('html', input.html)
  }

  const response = await fetch(
    `https://api.mailgun.net/v3/${mailgunConfig.domain}/messages`,
    {
      method: 'POST',
      headers: {
        'authorization': `Basic ${Buffer.from(`api:${mailgunConfig.apiKey}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: payload.toString()
    }
  )

  if (!response.ok) {
    const responseBody = await response.text()
    throw new Error(`Mailgun request failed (${response.status}): ${responseBody}`)
  }

  return { delivered: true }
}

export async function sendVendorInviteEmail(input: {
  recipientEmail: string
  recipientName: string
  invitePath: string
  expiresAt: Date
}): Promise<EmailDeliveryResult> {
  const inviteUrl = buildAbsoluteAppUrl(input.invitePath)

  const subject = 'You are invited to your Book Suey vendor portal'
  const text = [
    `Hello ${input.recipientName},`,
    '',
    'An admin has invited you to access your Book Suey vendor account.',
    `Set your password here: ${inviteUrl}`,
    `This link expires on ${input.expiresAt.toLocaleString('en-US')}.`,
    '',
    'If you were not expecting this message, you can ignore this email.'
  ].join('\n')

  const html = [
    `<p>Hello ${input.recipientName},</p>`,
    '<p>An admin has invited you to access your Book Suey vendor account.</p>',
    `<p><a href="${inviteUrl}">Set your password</a></p>`,
    `<p>This link expires on ${input.expiresAt.toLocaleString('en-US')}.</p>`,
    '<p>If you were not expecting this message, you can ignore this email.</p>'
  ].join('')

  return sendEmailViaMailgun({
    to: input.recipientEmail,
    subject,
    text,
    html
  })
}

export async function sendVendorPasswordResetEmail(input: {
  recipientEmail: string
  recipientName: string
  resetPath: string
  expiresAt: Date
}): Promise<EmailDeliveryResult> {
  const resetUrl = buildAbsoluteAppUrl(input.resetPath)

  const subject = 'Reset your Book Suey vendor password'
  const text = [
    `Hello ${input.recipientName},`,
    '',
    'We received a request to reset your Book Suey vendor account password.',
    `Set your new password here: ${resetUrl}`,
    `This link expires on ${input.expiresAt.toLocaleString('en-US')}.`,
    '',
    'If you did not request this, you can ignore this email.'
  ].join('\n')

  const html = [
    `<p>Hello ${input.recipientName},</p>`,
    '<p>We received a request to reset your Book Suey vendor account password.</p>',
    `<p><a href="${resetUrl}">Set a new password</a></p>`,
    `<p>This link expires on ${input.expiresAt.toLocaleString('en-US')}.</p>`,
    '<p>If you did not request this, you can ignore this email.</p>'
  ].join('')

  return sendEmailViaMailgun({
    to: input.recipientEmail,
    subject,
    text,
    html
  })
}
