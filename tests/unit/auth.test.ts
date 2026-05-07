import { describe, it, expect, beforeAll } from 'vitest'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

// Mock environment variables
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-tests'
  process.env.JWT_EXPIRES_IN = '7d'
  process.env.BCRYPT_COST_FACTOR = '12'
})

describe('auth utilities', () => {
  describe('bcrypt password hashing', () => {
    it('should hash passwords with cost factor >= 12', async () => {
      const password = 'testPassword123'
      const hash = await bcrypt.hash(password, 12)

      expect(hash).toBeDefined()
      expect(hash).toMatch(/^\$2[aby]\$12\$/)
      expect(hash).not.toBe(password)
    })

    it('should verify correct password against hash', async () => {
      const password = 'testPassword123'
      const hash = await bcrypt.hash(password, 12)

      const isValid = await bcrypt.compare(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'testPassword123'
      const hash = await bcrypt.hash(password, 12)

      const isValid = await bcrypt.compare('wrongPassword', hash)
      expect(isValid).toBe(false)
    })
  })

  describe('JWT token generation and verification', () => {
    const secret = process.env.JWT_SECRET!

    it('should generate valid JWT token', () => {
      const payload = {
        vendorId: 'vendor_123',
        email: 'test@example.com',
        role: 'vendor' as const
      }

      const token = jwt.sign(payload, secret, { expiresIn: '7d' })

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3)
    })

    it('should verify and decode valid token', () => {
      const payload = {
        vendorId: 'vendor_123',
        email: 'test@example.com',
        role: 'vendor' as const
      }

      const token = jwt.sign(payload, secret, { expiresIn: '7d' })
      const decoded = jwt.verify(token, secret) as typeof payload

      expect(decoded.vendorId).toBe(payload.vendorId)
      expect(decoded.email).toBe(payload.email)
      expect(decoded.role).toBe(payload.role)
    })

    it('should reject expired token', () => {
      const payload = {
        vendorId: 'vendor_123',
        email: 'test@example.com',
        role: 'vendor' as const
      }

      const token = jwt.sign(payload, secret, { expiresIn: '1ms' })

      // Wait for token to expire
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(() => jwt.verify(token, secret)).toThrow(jwt.TokenExpiredError)
          resolve()
        }, 10)
      })
    })

    it('should reject invalid token', () => {
      expect(() => jwt.verify('invalid-token', secret)).toThrow(jwt.JsonWebTokenError)
    })
  })
})
