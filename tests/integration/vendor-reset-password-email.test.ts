import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Vendor } from '../../server/models/Vendor'
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
  await AuditEvent.deleteMany({})
})

describe('Vendor Reset Password Email Flow', () => {
  it('sends reset email and returns generic success for existing vendor', async () => {
    const sendResetEmailMock = vi.fn().mockResolvedValue({ delivered: true })

    vi.doMock('../../server/utils/email', () => ({
      sendVendorPasswordResetEmail: sendResetEmailMock
    }))

    await Vendor.create({
      vendorId: 'vendor_reset_1',
      legalName: 'Vendor Reset One',
      displayName: 'Reset One',
      email: 'reset-one@example.com',
      passwordHash: 'hash',
      status: 'active'
    })

    const { default: requestReset } = await import('../../server/api/vendor/reset-password.post')

    const result = await requestReset({
      body: {
        email: 'reset-one@example.com'
      }
    }) as { message: string, resetToken?: string }

    expect(result.message).toBe('If the email exists, a reset link has been sent.')
    expect(result.resetToken).toBeDefined()

    expect(sendResetEmailMock).toHaveBeenCalledTimes(1)

    const updatedVendor = await Vendor.findOne({ vendorId: 'vendor_reset_1' })
    expect(updatedVendor?.passwordResetToken).toBeDefined()
    expect(updatedVendor?.passwordResetExpires).toBeDefined()

    const auditEvent = await AuditEvent.findOne({
      action: 'password_reset_requested',
      entityId: 'vendor_reset_1'
    })
    expect(auditEvent).toBeDefined()
  })

  it('returns generic success even when reset email delivery fails', async () => {
    const sendResetEmailMock = vi.fn().mockRejectedValue(new Error('mailgun failed'))

    vi.doMock('../../server/utils/email', () => ({
      sendVendorPasswordResetEmail: sendResetEmailMock
    }))

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await Vendor.create({
      vendorId: 'vendor_reset_2',
      legalName: 'Vendor Reset Two',
      displayName: 'Reset Two',
      email: 'reset-two@example.com',
      passwordHash: 'hash',
      status: 'active'
    })

    const { default: requestReset } = await import('../../server/api/vendor/reset-password.post')

    const result = await requestReset({
      body: {
        email: 'reset-two@example.com'
      }
    }) as { message: string, resetToken?: string }

    expect(result.message).toBe('If the email exists, a reset link has been sent.')
    expect(result.resetToken).toBeDefined()

    expect(sendResetEmailMock).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalled()

    const updatedVendor = await Vendor.findOne({ vendorId: 'vendor_reset_2' })
    expect(updatedVendor?.passwordResetToken).toBeDefined()
    expect(updatedVendor?.passwordResetExpires).toBeDefined()

    const auditEvent = await AuditEvent.findOne({
      action: 'password_reset_requested',
      entityId: 'vendor_reset_2'
    })
    expect(auditEvent).toBeDefined()
  })
})
