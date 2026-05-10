import { connectToDatabase } from '../../config/database'
import { handlePayPalEvent } from '../../utils/paypalWebhookHandler'
import { verifyWebhookSignature } from '../../utils/paypalClient'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const transmissionId = getHeader(event, 'paypal-transmission-id')
  const transmissionTime = getHeader(event, 'paypal-transmission-time')
  const transmissionSignature = getHeader(event, 'paypal-transmission-sig')
  const certUrl = getHeader(event, 'paypal-cert-url')
  const authAlgo = getHeader(event, 'paypal-auth-algo')

  if (!transmissionId || !transmissionTime || !transmissionSignature || !certUrl || !authAlgo) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required PayPal webhook headers'
    })
  }

  const body = await readBody(event)

  const isValid = await verifyWebhookSignature({
    transmissionId,
    transmissionTime,
    transmissionSignature,
    certUrl,
    authAlgo,
    webhookEvent: body
  })

  if (!isValid) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid PayPal webhook signature'
    })
  }

  await handlePayPalEvent(body)

  return {
    ok: true
  }
})
