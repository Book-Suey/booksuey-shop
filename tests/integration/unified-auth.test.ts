import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { AdminAccount } from '../../server/models/AdminAccount'
import { Vendor } from '../../server/models/Vendor'
import { hashPassword } from '../../server/utils/auth'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-key-for-integration-tests'
  process.env.JWT_EXPIRES_IN = '7d'
  process.env.BCRYPT_COST_FACTOR = '12'

  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  process.env.MONGODB_URI = uri
  await mongoose.connect(uri)

  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body ?? {})
  vi.stubGlobal('getHeader', (event: { headers?: Record<string, string | undefined> }, key: string) => event.headers?.[key])
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => {
    const error = new Error(input.statusMessage) as Error & { statusCode: number, statusMessage: string }
    error.statusCode = input.statusCode
    error.statusMessage = input.statusMessage
    return error
  })
})

afterAll(async () => {
  vi.unstubAllGlobals()
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  vi.resetModules()
  await AdminAccount.deleteMany({})
  await Vendor.deleteMany({})
})

describe('Unified Login Endpoint', () => {
  it('returns admin role response for admin credentials', async () => {
    await AdminAccount.create({
      adminId: 'admin_unified_1',
      email: 'admin-unified@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    const { default: unifiedLogin } = await import('../../server/api/auth/login.post')

    const result = await unifiedLogin({
      body: {
        email: 'admin-unified@example.com',
        password: 'StrongPass123!'
      },
      headers: {
        'x-real-ip': '127.0.0.1'
      }
    }) as { role: string, token: string, admin?: { adminId: string } }

    expect(result.role).toBe('admin')
    expect(result.token).toBeDefined()
    expect(result.admin?.adminId).toBe('admin_unified_1')
  })

  it('returns vendor role response for vendor credentials', async () => {
    await Vendor.create({
      vendorId: 'vendor_unified_1',
      legalName: 'Unified Vendor',
      displayName: 'Unified Vendor',
      email: 'vendor-unified@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    const { default: unifiedLogin } = await import('../../server/api/auth/login.post')

    const result = await unifiedLogin({
      body: {
        email: 'vendor-unified@example.com',
        password: 'StrongPass123!'
      },
      headers: {
        'x-real-ip': '127.0.0.1'
      }
    }) as { role: string, token: string, vendor?: { vendorId: string } }

    expect(result.role).toBe('vendor')
    expect(result.token).toBeDefined()
    expect(result.vendor?.vendorId).toBe('vendor_unified_1')
  })

  it('rejects login when email exists in both admin and vendor accounts', async () => {
    const email = 'role-conflict@example.com'

    await AdminAccount.create({
      adminId: 'admin_unified_2',
      email,
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    await Vendor.create({
      vendorId: 'vendor_unified_2',
      legalName: 'Role Conflict Vendor',
      displayName: 'Role Conflict Vendor',
      email,
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    const { default: unifiedLogin } = await import('../../server/api/auth/login.post')

    await expect(unifiedLogin({
      body: {
        email,
        password: 'StrongPass123!'
      },
      headers: {
        'x-real-ip': '127.0.0.1'
      }
    })).rejects.toMatchObject({
      statusCode: 409
    })
  })
})
