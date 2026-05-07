export interface JwtConfig {
  secret: string
  expiresIn: string
  issuer?: string
}

export interface BcryptConfig {
  costFactor: number
}

export interface RateLimitConfig {
  windowMs: number
  max: number
}

export interface AccountLockoutConfig {
  threshold: number
  durationMs: number
}

export function getJwtConfig(): JwtConfig {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment')
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'booksuey-shop'
  }
}

export function getBcryptConfig(): BcryptConfig {
  const costFactor = parseInt(process.env.BCRYPT_COST_FACTOR || '12', 10)
  if (costFactor < 12) {
    console.warn(`BCRYPT_COST_FACTOR should be >= 12, got ${costFactor}`)
  }
  return { costFactor }
}

export function getAuthRateLimitConfig(): RateLimitConfig {
  return {
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5', 10)
  }
}

export function getAccountLockoutConfig(): AccountLockoutConfig {
  return {
    threshold: parseInt(process.env.ACCOUNT_LOCKOUT_THRESHOLD || '10', 10),
    durationMs: parseInt(process.env.ACCOUNT_LOCKOUT_DURATION_MS || '1800000', 10) // 30 minutes
  }
}

export function getPasswordResetExpiryMs(): number {
  return 24 * 60 * 60 * 1000 // 24 hours
}
