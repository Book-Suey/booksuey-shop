import type { H3Event } from 'h3'

export function requireVendorId(event: H3Event): string {
  const vendorId = event.context.vendorId as string | undefined

  if (!vendorId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  return vendorId
}
