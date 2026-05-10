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

function buildBrandedEmailHtml(input: {
  recipientName: string
  title: string
  introText: string
  ctaLabel: string
  ctaUrl: string
  expiresText: string
  footerText: string
}): string {
  const logoUrl = buildAbsoluteAppUrl('/LogoIcon.svg')

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `<title>${input.title}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background-color:#f7fbf8;font-family:Arial,sans-serif;color:#1f3a30;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f7fbf8;padding:24px 12px;">',
    '<tr>',
    '<td align="center">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#fffef6;border:1px solid #d7e7de;border-radius:14px;overflow:hidden;">',
    '<tr>',
    '<td style="padding:24px 28px 12px 28px;background:linear-gradient(135deg,#fdf2d1 0%,#e4fff2 100%);">',
    `<img src="${logoUrl}" alt="Book Suey" width="56" height="56" style="display:block;border:0;outline:none;text-decoration:none;">`,
    '<p style="margin:12px 0 0 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#2f4a3d;font-weight:700;">Book Suey</p>',
    `<h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.3;color:#163127;">${input.title}</h1>`,
    '</td>',
    '</tr>',
    '<tr>',
    '<td style="padding:20px 28px 26px 28px;">',
    `<p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;">Hello ${input.recipientName},</p>`,
    `<p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:#304d3f;">${input.introText}</p>`,
    '<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px 0;">',
    '<tr>',
    '<td style="border-radius:8px;background-color:#2a8d4d;">',
    `<a href="${input.ctaUrl}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">${input.ctaLabel}</a>`,
    '</td>',
    '</tr>',
    '</table>',
    `<p style="margin:0 0 12px 0;font-size:14px;line-height:1.6;color:#304d3f;">${input.expiresText}</p>`,
    `<p style="margin:0;font-size:13px;line-height:1.6;color:#5a7468;">${input.footerText}</p>`,
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
    '</tr>',
    '</table>',
    '</body>',
    '</html>'
  ].join('')
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

  const html = buildBrandedEmailHtml({
    recipientName: input.recipientName,
    title: 'You are invited',
    introText: 'An admin has invited you to access your Book Suey vendor account.',
    ctaLabel: 'Set your password',
    ctaUrl: inviteUrl,
    expiresText: `This link expires on ${input.expiresAt.toLocaleString('en-US')}.`,
    footerText: 'If you were not expecting this message, you can ignore this email.'
  })

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

  const html = buildBrandedEmailHtml({
    recipientName: input.recipientName,
    title: 'Reset your vendor password',
    introText: 'We received a request to reset your Book Suey vendor account password.',
    ctaLabel: 'Set a new password',
    ctaUrl: resetUrl,
    expiresText: `This link expires on ${input.expiresAt.toLocaleString('en-US')}.`,
    footerText: 'If you did not request this, you can ignore this email.'
  })

  return sendEmailViaMailgun({
    to: input.recipientEmail,
    subject,
    text,
    html
  })
}

export async function sendAdminPasswordResetEmail(input: {
  recipientEmail: string
  recipientName: string
  resetPath: string
  expiresAt: Date
}): Promise<EmailDeliveryResult> {
  const resetUrl = buildAbsoluteAppUrl(input.resetPath)

  const subject = 'Reset your Book Suey admin password'
  const text = [
    `Hello ${input.recipientName},`,
    '',
    'We received a request to reset your Book Suey admin account password.',
    `Set your new password here: ${resetUrl}`,
    `This link expires on ${input.expiresAt.toLocaleString('en-US')}.`,
    '',
    'If you did not request this, you can ignore this email.'
  ].join('\n')

  const html = buildBrandedEmailHtml({
    recipientName: input.recipientName,
    title: 'Reset your admin password',
    introText: 'We received a request to reset your Book Suey admin account password.',
    ctaLabel: 'Set a new password',
    ctaUrl: resetUrl,
    expiresText: `This link expires on ${input.expiresAt.toLocaleString('en-US')}.`,
    footerText: 'If you did not request this, you can ignore this email.'
  })

  return sendEmailViaMailgun({
    to: input.recipientEmail,
    subject,
    text,
    html
  })
}
