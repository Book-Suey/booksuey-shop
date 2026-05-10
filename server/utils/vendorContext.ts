import type { H3Event } from 'h3'

export type VendorScope = {
  vendorId: string
  approvedVendorId?: string
}

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

export function requireVendorScope(event: H3Event): VendorScope {
  const vendorId = requireVendorId(event)
  const approvedVendorId = (event.context.vendor as { approvedVendorId?: string } | undefined)?.approvedVendorId

  return {
    vendorId,
    approvedVendorId: approvedVendorId || undefined
  }
}
