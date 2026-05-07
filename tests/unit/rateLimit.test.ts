import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { checkRateLimit, getRateLimitKey } from '../../server/utils/rateLimit'

describe('rate limiting', () => {
  beforeEach(() => {
    // Reset rate limit store between tests
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getRateLimitKey', () => {
    it('should generate unique rate limit key from email and IP', () => {
      const key = getRateLimitKey('test@example.com', '192.168.1.1')
      expect(key).toBe('test@example.com:192.168.1.1')
    })
  })

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-key')

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4) // 5 max, 1 used
    })

    it('should increment counter on subsequent requests', () => {
      const key = 'test-key-increment'

      const result1 = checkRateLimit(key)
      expect(result1.remaining).toBe(4)

      const result2 = checkRateLimit(key)
      expect(result2.remaining).toBe(3)

      const result3 = checkRateLimit(key)
      expect(result3.remaining).toBe(2)
    })

    it('should block after max attempts reached', () => {
      const key = 'test-key-block'

      // Use all 5 attempts
      for (let i = 0; i < 5; i++) {
        checkRateLimit(key)
      }

      // 6th attempt should be blocked
      const result = checkRateLimit(key)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('should reset counter after window expires', () => {
      const key = 'test-key-reset'

      // Use 3 attempts
      for (let i = 0; i < 3; i++) {
        checkRateLimit(key)
      }

      // Move time forward past the window (15 minutes + 1 second)
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000)

      // Should reset and allow again
      const result = checkRateLimit(key)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(4)
    })
  })
})
