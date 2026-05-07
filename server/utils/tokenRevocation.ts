import { createClient } from 'redis'

const revocationFallback = new Map<string, number>()

type RedisClient = ReturnType<typeof createClient>

let redisClientPromise: Promise<RedisClient | null> | null = null

function cleanupFallback(now: number = Date.now()): void {
  for (const [tokenHash, expiresAt] of revocationFallback.entries()) {
    if (expiresAt <= now) {
      revocationFallback.delete(tokenHash)
    }
  }
}

function getRedisUrl(): string | null {
  return process.env.REDIS_URL || null
}

async function getRedisClient(): Promise<RedisClient | null> {
  const redisUrl = getRedisUrl()
  if (!redisUrl) {
    return null
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      try {
        const client = createClient({
          url: redisUrl,
          socket: {
            connectTimeout: 1000
          }
        })

        client.on('error', (error) => {
          console.warn('[auth] Redis token revocation client error:', error)
        })

        await client.connect()
        return client
      } catch (error) {
        console.warn('[auth] Failed to connect Redis for token revocation, using in-memory fallback:', error)
        return null
      }
    })()
  }

  return redisClientPromise
}

function getRedisKey(tokenHash: string): string {
  return `auth:revoked-token:${tokenHash}`
}

export async function revokeTokenHash(tokenHash: string, expiresAtMs: number): Promise<void> {
  cleanupFallback()
  revocationFallback.set(tokenHash, expiresAtMs)

  const ttlSeconds = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 1000))
  const client = await getRedisClient()
  if (!client) {
    return
  }

  try {
    await client.set(getRedisKey(tokenHash), '1', { EX: ttlSeconds })
  } catch (error) {
    console.warn('[auth] Failed to persist revoked token in Redis, using in-memory fallback:', error)
  }
}

export async function isTokenHashRevoked(tokenHash: string): Promise<boolean> {
  cleanupFallback()
  if (revocationFallback.has(tokenHash)) {
    return true
  }

  const client = await getRedisClient()
  if (!client) {
    return false
  }

  try {
    const exists = await client.exists(getRedisKey(tokenHash))
    return exists === 1
  } catch (error) {
    console.warn('[auth] Failed to check revoked token in Redis, using in-memory fallback only:', error)
    return false
  }
}
