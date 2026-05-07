import { getAuthRateLimitConfig } from '../config/auth'

export interface RateLimitConfig {
  max: number
  windowMs: number
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
}

export function checkRateLimit(identifier: string, config: RateLimitConfig = getAuthRateLimitConfig()): RateLimitResult {
  const now = Date.now()
  const key = `ratelimit:${identifier}`
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetTime) {
    // Reset the counter
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs
    }
    rateLimitStore.set(key, newEntry)
    return {
      allowed: true,
      remaining: config.max - 1,
      resetTime: newEntry.resetTime
    }
  }

  if (entry.count >= config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime
    }
  }

  entry.count++
  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetTime: entry.resetTime
  }
}

export function getRateLimitKey(email: string, ip: string): string {
  return `${email}:${ip}`
}

export function resetRateLimitStore(): void {
  rateLimitStore.clear()
}
