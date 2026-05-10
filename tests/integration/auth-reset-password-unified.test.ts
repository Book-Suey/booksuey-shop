import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Vendor } from '../../server/models/Vendor'
import { AdminAccount } from '../../server/models/AdminAccount'
import { AuditEvent } from '../../server/models/AuditEvent'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  process.env.BCRYPT_COST_FACTOR = '12'

  mongoServer = await MongoMemoryServer.create()
  const uri = mongoServer.getUri()
  process.env.MONGODB_URI = uri
  await mongoose.connect(uri)

  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', async (event: { body?: unknown }) => event.body ?? {})
  vi.stubGlobal('getQuery', (event: { query?: unknown }) => event.query ?? {})
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
  vi.restoreAllMocks()
  await Vendor.deleteMany({})
  await AdminAccount.deleteMany({})
  await AuditEvent.deleteMany({})
})

describe('Unified Password Reset Flow', () => {
  it('prefers vendor account when vendor and admin share the same email', async () => {
    const sendVendorPasswordResetEmail = vi.fn().mockResolvedValue({ delivered: true })
    const sendAdminPasswordResetEmail = vi.fn().mockResolvedValue({ delivered: true })

    vi.doMock('../../server/utils/email', () => ({
      sendVendorPasswordResetEmail,
      sendAdminPasswordResetEmail
    }))

    await Vendor.create({
      vendorId: 'vendor_unified_1',
      legalName: 'Unified Vendor One',
      displayName: 'Unified Vendor One',
      email: 'shared@example.com',
      passwordHash: 'vendor-hash',
      status: 'active'
    })

    await AdminAccount.create({
      adminId: 'admin_unified_1',
      displayName: 'Unified Admin One',
      email: 'shared@example.com',
      passwordHash: 'admin-hash',
      status: 'active'
    })

    const { default: requestReset } = await import('../../server/api/auth/reset-password.post')

    const result = await requestReset({
      body: {
        email: 'shared@example.com'
      }
    }) as { message: string, resetToken?: string }

    expect(result.message).toBe('If the email exists, a reset link has been sent.')
    expect(result.resetToken).toBeDefined()

    expect(sendVendorPasswordResetEmail).toHaveBeenCalledTimes(1)
    expect(sendAdminPasswordResetEmail).not.toHaveBeenCalled()

    const vendor = await Vendor.findOne({ vendorId: 'vendor_unified_1' })
    const admin = await AdminAccount.findOne({ adminId: 'admin_unified_1' })

    expect(vendor?.passwordResetToken).toBeDefined()
    expect(admin?.passwordResetToken).toBeUndefined()

    const vendorAudit = await AuditEvent.findOne({
      action: 'password_reset_requested',
      entityType: 'Vendor',
      entityId: 'vendor_unified_1'
    })
    expect(vendorAudit).toBeDefined()
  })

  it('falls back to admin account when no vendor exists for email', async () => {
    const sendVendorPasswordResetEmail = vi.fn().mockResolvedValue({ delivered: true })
    const sendAdminPasswordResetEmail = vi.fn().mockResolvedValue({ delivered: true })

    vi.doMock('../../server/utils/email', () => ({
      sendVendorPasswordResetEmail,
      sendAdminPasswordResetEmail
    }))

    await AdminAccount.create({
      adminId: 'admin_unified_2',
      displayName: 'Unified Admin Two',
      email: 'admin-only@example.com',
      passwordHash: 'admin-hash',
      status: 'active'
    })

    const { default: requestReset } = await import('../../server/api/auth/reset-password.post')

    const result = await requestReset({
      body: {
        email: 'admin-only@example.com'
      }
    }) as { message: string, resetToken?: string }

    expect(result.message).toBe('If the email exists, a reset link has been sent.')
    expect(result.resetToken).toBeDefined()

    expect(sendVendorPasswordResetEmail).not.toHaveBeenCalled()
    expect(sendAdminPasswordResetEmail).toHaveBeenCalledTimes(1)

    const admin = await AdminAccount.findOne({ adminId: 'admin_unified_2' })
    expect(admin?.passwordResetToken).toBeDefined()

    const adminAudit = await AuditEvent.findOne({
      action: 'password_reset_requested',
      entityType: 'AdminAccount',
      entityId: 'admin_unified_2'
    })
    expect(adminAudit).toBeDefined()
  })

  it('verifies a valid admin reset token', async () => {
    const expiresAt = new Date(Date.now() + 60_000)

    await AdminAccount.create({
      adminId: 'admin_unified_3',
      displayName: 'Unified Admin Three',
      email: 'admin-verify@example.com',
      passwordHash: 'admin-hash',
      status: 'active',
      passwordResetToken: 'admin-reset-token',
      passwordResetExpires: expiresAt
    })

    const { default: verifyResetToken } = await import('../../server/api/auth/verify-reset-token.get')

    const result = await verifyResetToken({
      query: {
        token: 'admin-reset-token'
      }
    }) as { valid: boolean, email: string, role: 'vendor' | 'admin' }

    expect(result).toEqual({
      valid: true,
      email: 'admin-verify@example.com',
      role: 'admin'
    })
  })

  it('updates password for admin token and clears reset token', async () => {
    const hashPassword = vi.fn().mockResolvedValue('new-admin-password-hash')

    vi.doMock('../../server/utils/auth', () => ({
      hashPassword
    }))

    const expiresAt = new Date(Date.now() + 60_000)

    await AdminAccount.create({
      adminId: 'admin_unified_4',
      displayName: 'Unified Admin Four',
      email: 'admin-update@example.com',
      passwordHash: 'old-admin-password-hash',
      status: 'active',
      passwordResetToken: 'admin-update-token',
      passwordResetExpires: expiresAt
    })

    const { default: updatePassword } = await import('../../server/api/auth/update-password.post')

    const result = await updatePassword({
      body: {
        token: 'admin-update-token',
        password: 'new-password-123'
      }
    }) as { message: string }

    expect(result.message).toBe('Password updated successfully')
    expect(hashPassword).toHaveBeenCalledWith('new-password-123')

    const admin = await AdminAccount.findOne({ adminId: 'admin_unified_4' })
    expect(admin?.passwordHash).toBe('new-admin-password-hash')
    expect(admin?.passwordResetToken).toBeUndefined()
    expect(admin?.passwordResetExpires).toBeUndefined()

    const adminAudit = await AuditEvent.findOne({
      action: 'password_reset_completed',
      entityType: 'AdminAccount',
      entityId: 'admin_unified_4'
    })
    expect(adminAudit).toBeDefined()
  })
})
