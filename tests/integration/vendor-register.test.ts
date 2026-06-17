import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Vendor } from '../../server/models/Vendor'
import { ApprovedVendor } from '../../server/models/ApprovedVendor'
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
  vi.stubGlobal(
    'readBody',
    async (event: { body?: unknown }) => event.body ?? {}
  )
  vi.stubGlobal(
    'createError',
    (input: { statusCode: number, statusMessage: string }) => {
      const error = new Error(input.statusMessage) as Error & {
        statusCode: number
        statusMessage: string
      }
      error.statusCode = input.statusCode
      error.statusMessage = input.statusMessage
      return error
    }
  )
}, 120000)

afterAll(async () => {
  vi.unstubAllGlobals()
  await mongoose.disconnect()

  if (mongoServer) {
    await mongoServer.stop()
  }
})

beforeEach(async () => {
  vi.resetModules()
  await Vendor.deleteMany({})
  await ApprovedVendor.deleteMany({})
  await AdminAccount.deleteMany({})
  await AuditEvent.deleteMany({})
})

describe('Vendor registration endpoint', () => {
  it('registers and links vendor when email exists in approved vendor list', async () => {
    await ApprovedVendor.create({
      basilId: 'BASIL-REG-1',
      firstName: 'Jane',
      lastName: 'Vendor',
      email: 'approved@example.com'
    })

    const { default: registerVendor }
      = await import('../../server/api/vendor/register.post')

    const result = (await registerVendor({
      body: {
        legalName: 'Approved Vendor LLC',
        displayName: 'Approved Vendor',
        email: 'approved@example.com',
        password: 'StrongPass123!'
      }
    })) as { vendor: { email: string, autoLinked: boolean, vendorId: string } }

    expect(result.vendor.email).toBe('approved@example.com')
    expect(result.vendor.autoLinked).toBe(true)

    const savedVendor = await Vendor.findOne({ email: 'approved@example.com' })
    expect(savedVendor).toBeDefined()
    expect(savedVendor?.approvedVendorId).toBe('BASIL-REG-1')

    const auditEvent = await AuditEvent.findOne({
      action: 'vendor_registered',
      entityType: 'Vendor',
      entityId: result.vendor.vendorId
    })
    expect(auditEvent).toBeDefined()
  })

  it('rejects registration when email is not in approved vendor list', async () => {
    const { default: registerVendor }
      = await import('../../server/api/vendor/register.post')

    await expect(
      registerVendor({
        body: {
          legalName: 'Unapproved Vendor LLC',
          displayName: 'Unapproved Vendor',
          email: 'not-approved@example.com',
          password: 'StrongPass123!'
        }
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      statusMessage: 'Registration is only available to approved vendors'
    })

    const savedVendor = await Vendor.findOne({
      email: 'not-approved@example.com'
    })
    expect(savedVendor).toBeNull()

    const auditEvent = await AuditEvent.findOne({
      action: 'vendor_registered'
    })
    expect(auditEvent).toBeNull()
  })
})
