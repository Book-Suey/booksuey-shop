import { verifyToken } from './auth'
import type { H3Event } from 'h3'

type AdminIdentity = {
  actorId: string
  actorRole: 'admin'
}

export async function requireAdmin(event: H3Event): Promise<AdminIdentity> {
  // Accept the httpOnly cookie (set on login, forwarded automatically in SSR fetches)
  // or an Authorization header (sent by client-side mutations for backward compatibility).
  const cookieToken = getCookie(event, 'booksuey-admin-token')
  const authHeader = getHeader(event, 'authorization')

  let token: string | undefined
  if (cookieToken) {
    token = cookieToken
  }
  else if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7)
  }

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - No token provided'
    })
  }
  const payload = await verifyToken(token)

  if (payload.role !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden'
    })
  }

  if (!payload.adminId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - Invalid admin token'
    })
  }

  return {
    actorId: payload.adminId,
    actorRole: 'admin'
  }
}
