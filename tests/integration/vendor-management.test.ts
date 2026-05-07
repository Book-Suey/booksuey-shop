import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { Vendor } from '../../server/models/Vendor'
import { ApprovedVendor } from '../../server/models/ApprovedVendor'
import { AuditEvent } from '../../server/models/AuditEvent'
import { hashPassword, generateToken } from '../../server/utils/auth'

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
  vi.stubGlobal('getRouterParam', (event: { params?: Record<string, string> }, key: string) => event.params?.[key])
  vi.stubGlobal('getQuery', (event: { query?: Record<string, unknown> }) => event.query ?? {})
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
  await Vendor.deleteMany({})
  await ApprovedVendor.deleteMany({})
  await AuditEvent.deleteMany({})
})

function adminHeaders(): Record<string, string> {
  const { token } = generateToken({
    adminId: 'admin_test_user',
    email: 'admin@example.com',
    role: 'admin'
  })

  return {
    authorization: `Bearer ${token}`
  }
}

describe('Admin Vendor Management Endpoints', () => {
  it('creates an approved vendor and rejects duplicate basilId', async () => {
    const { default: createApprovedVendor } = await import('../../server/api/admin/approved-vendors/index.post')

    const first = await createApprovedVendor({
      headers: adminHeaders(),
      body: {
        basilId: 'BASIL-100',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com'
      }
    }) as { approvedVendor: { basilId: string } }

    expect(first.approvedVendor.basilId).toBe('BASIL-100')

    await expect(createApprovedVendor({
      headers: adminHeaders(),
      body: {
        basilId: 'BASIL-100',
        firstName: 'Alan',
        lastName: 'Turing',
        email: 'alan@example.com'
      }
    })).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('rejects approved vendor creation with duplicate email', async () => {
    const { default: createApprovedVendor } = await import('../../server/api/admin/approved-vendors/index.post')

    await createApprovedVendor({
      headers: adminHeaders(),
      body: {
        basilId: 'BASIL-EMAIL-1',
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com'
      }
    })

    await expect(createApprovedVendor({
      headers: adminHeaders(),
      body: {
        basilId: 'BASIL-EMAIL-2',
        firstName: 'Katherine',
        lastName: 'Johnson',
        email: 'grace@example.com'
      }
    })).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('creates a vendor and rejects duplicate email', async () => {
    const { default: createVendor } = await import('../../server/api/admin/vendors/index.post')

    const created = await createVendor({
      headers: adminHeaders(),
      body: {
        legalName: 'Example Trading LLC',
        displayName: 'Example Trading',
        email: 'vendor@example.com',
        password: 'StrongPass123!'
      }
    }) as { vendor: { email: string, vendorId: string } }

    expect(created.vendor.email).toBe('vendor@example.com')
    expect(created.vendor.vendorId).toContain('vendor_')

    await expect(createVendor({
      headers: adminHeaders(),
      body: {
        legalName: 'Example Trading 2 LLC',
        displayName: 'Example Trading 2',
        email: 'vendor@example.com',
        password: 'StrongPass123!'
      }
    })).rejects.toMatchObject({
      statusCode: 409
    })
  })

  it('updates vendor profile and records audit for status change', async () => {
    const vendor = await Vendor.create({
      vendorId: 'vendor_status_test',
      legalName: 'Status Test LLC',
      displayName: 'Status Test',
      email: 'status@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    const { default: patchVendor } = await import('../../server/api/admin/vendors/[vendorId].patch')

    const result = await patchVendor({
      headers: adminHeaders(),
      params: { vendorId: vendor.vendorId },
      body: {
        status: 'inactive',
        displayName: 'Status Test Updated'
      }
    }) as { vendor: { status: string, displayName: string } }

    expect(result.vendor.status).toBe('inactive')
    expect(result.vendor.displayName).toBe('Status Test Updated')

    const auditEvent = await AuditEvent.findOne({ entityId: vendor.vendorId }).sort({ createdAt: -1 })
    expect(auditEvent).toBeDefined()
    expect(auditEvent?.action).toBe('vendor_updated')
    expect(auditEvent?.before?.status).toBe('active')
    expect(auditEvent?.after?.status).toBe('inactive')
  })

  it('returns no changes for no-op vendor update and does not create a new audit event', async () => {
    const vendor = await Vendor.create({
      vendorId: 'vendor_noop_test',
      legalName: 'Noop Test LLC',
      displayName: 'Noop Test',
      email: 'noop@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    const baselineAuditCount = await AuditEvent.countDocuments({ entityId: vendor.vendorId })

    const { default: patchVendor } = await import('../../server/api/admin/vendors/[vendorId].patch')

    const result = await patchVendor({
      headers: adminHeaders(),
      params: { vendorId: vendor.vendorId },
      body: {
        legalName: 'Noop Test LLC',
        displayName: 'Noop Test',
        email: 'noop@example.com',
        status: 'active'
      }
    }) as { message: string, vendor: { vendorId: string } }

    expect(result.message).toBe('No changes detected')
    expect(result.vendor.vendorId).toBe(vendor.vendorId)

    const finalAuditCount = await AuditEvent.countDocuments({ entityId: vendor.vendorId })
    expect(finalAuditCount).toBe(baselineAuditCount)
  })

  it('supports vendor lookup by external approvedVendorId', async () => {
    const approvedVendor = await ApprovedVendor.create({
      basilId: 'BASIL-LOOKUP-1',
      firstName: 'Linus',
      lastName: 'Torvalds',
      email: 'linus@example.com'
    })

    await Vendor.create({
      vendorId: 'vendor_lookup_1',
      legalName: 'Lookup Corp',
      displayName: 'Lookup',
      email: 'lookup@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active',
      approvedVendorId: approvedVendor.basilId
    })

    const { default: getVendor } = await import('../../server/api/admin/vendors/[vendorId].get')

    const result = await getVendor({
      headers: adminHeaders(),
      params: { vendorId: approvedVendor.basilId }
    }) as { vendor: { approvedVendorId: string } }

    expect(result.vendor.approvedVendorId).toBe('BASIL-LOOKUP-1')
  })

  it('updates approved vendor fields and cascades basilId changes to linked vendors', async () => {
    await ApprovedVendor.create({
      basilId: 'BASIL-CASCADE-OLD',
      firstName: 'Margaret',
      lastName: 'Hamilton',
      email: 'margaret@example.com'
    })

    const linkedVendor = await Vendor.create({
      vendorId: 'vendor_cascade_1',
      legalName: 'Cascade Corp',
      displayName: 'Cascade',
      email: 'cascade@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active',
      approvedVendorId: 'BASIL-CASCADE-OLD'
    })

    const { default: patchApprovedVendor } = await import('../../server/api/admin/approved-vendors/[approvedVendorId].patch')

    const result = await patchApprovedVendor({
      headers: adminHeaders(),
      params: { approvedVendorId: 'BASIL-CASCADE-OLD' },
      body: {
        basilId: 'BASIL-CASCADE-NEW',
        phone: '555-1000'
      }
    }) as { approvedVendor: { basilId: string, phone?: string } }

    expect(result.approvedVendor.basilId).toBe('BASIL-CASCADE-NEW')
    expect(result.approvedVendor.phone).toBe('555-1000')

    const refreshedVendor = await Vendor.findOne({ vendorId: linkedVendor.vendorId })
    expect(refreshedVendor?.approvedVendorId).toBe('BASIL-CASCADE-NEW')

    const auditEvent = await AuditEvent.findOne({
      action: 'approved_vendor_updated',
      entityId: 'BASIL-CASCADE-NEW'
    }).sort({ createdAt: -1 })

    expect(auditEvent).toBeDefined()
    expect(auditEvent?.before?.basilId).toBe('BASIL-CASCADE-OLD')
    expect(auditEvent?.after?.basilId).toBe('BASIL-CASCADE-NEW')
  })

  it('lists vendors and supports status filtering', async () => {
    await Vendor.create({
      vendorId: 'vendor_list_active',
      legalName: 'List Active LLC',
      displayName: 'List Active',
      email: 'list-active@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'active'
    })

    await Vendor.create({
      vendorId: 'vendor_list_inactive',
      legalName: 'List Inactive LLC',
      displayName: 'List Inactive',
      email: 'list-inactive@example.com',
      passwordHash: await hashPassword('StrongPass123!'),
      status: 'inactive'
    })

    const { default: listVendors } = await import('../../server/api/admin/vendors/index.get')

    const filtered = await listVendors({
      headers: adminHeaders(),
      query: { status: 'inactive' }
    }) as { vendors: Array<{ vendorId: string, status: string }> }

    expect(filtered.vendors).toHaveLength(1)
    expect(filtered.vendors[0].vendorId).toBe('vendor_list_inactive')
    expect(filtered.vendors[0].status).toBe('inactive')
  })
})
