import { verifyToken } from './auth'
import type { H3Event } from 'h3'

type AdminIdentity = {
  actorId: string
  actorRole: 'admin'
}

export async function requireAdmin(event: H3Event): Promise<AdminIdentity> {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized - No token provided'
    })
  }

  const token = authHeader.substring(7)
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
