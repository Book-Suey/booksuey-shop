import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { getJwtConfig, getBcryptConfig } from '../config/auth'
import { revokeTokenHash, isTokenHashRevoked } from './tokenRevocation'

export interface JwtPayload {
  vendorId?: string
  adminId?: string
  email: string
  role: 'vendor' | 'admin'
  iat?: number
  exp?: number
}

export interface JwtResult {
  token: string
  payload: JwtPayload
}

function createAuthError(statusCode: number, message: string): Error {
  const maybeCreateError = (globalThis as { createError?: (input: { statusCode: number, message: string }) => Error }).createError
  if (typeof maybeCreateError === 'function') {
    return maybeCreateError({ statusCode, message })
  }

  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function getTokenExpiryMs(token: string): number {
  const decoded = jwt.decode(token) as JwtPayload | null

  if (decoded?.exp) {
    return decoded.exp * 1000
  }

  // Fallback for malformed tokens: keep revocation for 7 days.
  return Date.now() + (7 * 24 * 60 * 60 * 1000)
}

export async function hashPassword(password: string): Promise<string> {
  const { costFactor } = getBcryptConfig()
  return bcrypt.hash(password, costFactor)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): JwtResult {
  const config = getJwtConfig()
  const token = jwt.sign(payload, config.secret, {
    expiresIn: config.expiresIn as jwt.SignOptions['expiresIn'],
    issuer: config.issuer
  })
  return { token, payload: { ...payload, iat: Math.floor(Date.now() / 1000) } }
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  if (await isTokenRevoked(token)) {
    throw createAuthError(401, 'Token has been revoked')
  }

  const config = getJwtConfig()
  try {
    const decoded = jwt.verify(token, config.secret, {
      issuer: config.issuer
    }) as JwtPayload
    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw createAuthError(401, 'Token has expired')
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw createAuthError(401, 'Invalid token')
    }
    throw error
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload
  } catch {
    return null
  }
}

export async function revokeToken(token: string): Promise<void> {
  const tokenHash = hashToken(token)
  const expiresAt = getTokenExpiryMs(token)
  await revokeTokenHash(tokenHash, expiresAt)
}

export async function isTokenRevoked(token: string): Promise<boolean> {
  const tokenHash = hashToken(token)
  return isTokenHashRevoked(tokenHash)
}
