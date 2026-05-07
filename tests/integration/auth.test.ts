import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Vendor } from '../../server/models/Vendor'
import { ApprovedVendor } from '../../server/models/ApprovedVendor'
import { AuditEvent } from '../../server/models/AuditEvent'
import { hashPassword, verifyPassword, generateToken, verifyToken, revokeToken } from '../../server/utils/auth'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-for-integration-tests'
  process.env.JWT_EXPIRES_IN = '7d'
  process.env.BCRYPT_COST_FACTOR = '12'

  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  await mongoose.connect(uri)
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Vendor.deleteMany({})
  await ApprovedVendor.deleteMany({})
  await AuditEvent.deleteMany({})
})

describe('Authentication Utilities - Integration', () => {
  describe('Password hashing', () => {
    it('should hash password with bcrypt cost factor 12', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).toMatch(/^\$2[aby]\$12\$/)
      expect(hash).not.toBe(password)
    })

    it('should verify correct password', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'testPassword123'
      const hash = await hashPassword(password)

      const isValid = await verifyPassword('wrongPassword', hash)
      expect(isValid).toBe(false)
    })
  })

  describe('JWT tokens', () => {
    it('should generate valid token', () => {
      const { token, payload } = generateToken({
        vendorId: 'vendor_123',
        email: 'test@example.com',
        role: 'vendor'
      })

      expect(token).toBeDefined()
      expect(payload.vendorId).toBe('vendor_123')
      expect(payload.email).toBe('test@example.com')
    })

    it('should verify valid token', async () => {
      const { token } = generateToken({
        vendorId: 'vendor_456',
        email: 'verify@example.com',
        role: 'vendor'
      })

      const decoded = await verifyToken(token)
      expect(decoded.vendorId).toBe('vendor_456')
      expect(decoded.email).toBe('verify@example.com')
    })

    it('should reject revoked token', async () => {
      const { token } = generateToken({
        vendorId: 'vendor_789',
        email: 'revoked@example.com',
        role: 'vendor'
      })

      await revokeToken(token)

      await expect(verifyToken(token)).rejects.toMatchObject({
        statusCode: 401
      })
    })
  })
})

describe('Vendor Model', () => {
  it('should create and save a vendor', async () => {
    const vendor = await Vendor.create({
      vendorId: 'test_vendor_1',
      legalName: 'Test Vendor',
      displayName: 'Test',
      email: 'test@example.com',
      passwordHash: await hashPassword('password'),
      status: 'active'
    })

    expect(vendor.vendorId).toBe('test_vendor_1')
    expect(vendor.email).toBe('test@example.com')
    expect(vendor.status).toBe('active')
  })

  it('should enforce unique email constraint', async () => {
    await Vendor.create({
      vendorId: 'vendor_unique_1',
      legalName: 'Vendor 1',
      displayName: 'V1',
      email: 'unique@example.com',
      passwordHash: await hashPassword('password'),
      status: 'active'
    })

    await expect(Vendor.create({
      vendorId: 'vendor_unique_2',
      legalName: 'Vendor 2',
      displayName: 'V2',
      email: 'unique@example.com',
      passwordHash: await hashPassword('password'),
      status: 'active'
    })).rejects.toThrow()
  })
})

describe('ApprovedVendor Model', () => {
  it('should create and save an approved vendor', async () => {
    const approvedVendor = await ApprovedVendor.create({
      basilId: 'BASIL001',
      lastName: 'Doe',
      firstName: 'Jane',
      email: 'jane@example.com'
    })

    expect(approvedVendor.basilId).toBe('BASIL001')
    expect(approvedVendor.email).toBe('jane@example.com')
  })
})

describe('AuditEvent Model', () => {
  it('should create and save an audit event', async () => {
    const event = await AuditEvent.create({
      auditEventId: 'audit_123',
      actorId: 'vendor_123',
      actorRole: 'vendor',
      action: 'vendor_login',
      entityType: 'Vendor',
      entityId: 'vendor_123'
    })

    expect(event.auditEventId).toBe('audit_123')
    expect(event.actorRole).toBe('vendor')
    expect(event.action).toBe('vendor_login')
  })
})
