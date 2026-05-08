import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { AdminAccount } from '../../server/models/AdminAccount'
import { generateToken, hashPassword } from '../../server/utils/auth'

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
})

describe('Admin Authentication Endpoints', () => {
  it('returns authenticated admin profile for valid admin token', async () => {
    await AdminAccount.create({
      adminId: 'admin_auth_3',
      email: 'me-admin@example.com',
      displayName: 'Admin Auth Three',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    const { token } = generateToken({
      adminId: 'admin_auth_3',
      email: 'me-admin@example.com',
      role: 'admin'
    })

    const { default: adminMe } = await import('../../server/api/admin/me.get')

    const result = await adminMe({
      headers: {
        authorization: `Bearer ${token}`
      }
    }) as { admin: { adminId: string, displayName: string, email: string, status: string } }

    expect(result.admin.adminId).toBe('admin_auth_3')
    expect(result.admin.displayName).toBe('Admin Auth Three')
    expect(result.admin.email).toBe('me-admin@example.com')
    expect(result.admin.status).toBe('active')
  })
})
