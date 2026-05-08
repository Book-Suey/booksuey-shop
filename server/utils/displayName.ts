import { AdminAccount } from '../models/AdminAccount'
import { Vendor } from '../models/Vendor'

export function formatAdminDisplayName(admin: {
  adminId: string
  displayName?: string
  email?: string
}): string {
  const explicitName = admin.displayName?.trim()

  if (explicitName) {
    return explicitName
  }

  const emailName = admin.email?.trim()
  if (emailName) {
    return emailName
  }

  return admin.adminId
}

export async function getAdminDisplayNameMap(adminIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(adminIds.filter(Boolean)))

  if (uniqueIds.length === 0) {
    return new Map()
  }

  const admins = await AdminAccount.find({
    adminId: { $in: uniqueIds }
  }).select('adminId displayName email')

  const map = new Map<string, string>()

  for (const admin of admins as Array<{ adminId: string, displayName?: string, email?: string }>) {
    map.set(admin.adminId, formatAdminDisplayName(admin))
  }

  return map
}

export async function getActorDisplayNameMap(
  actors: Array<{ actorId: string, actorRole: 'admin' | 'vendor' }>
): Promise<Map<string, string>> {
  const adminIds = Array.from(new Set(
    actors.filter(actor => actor.actorRole === 'admin').map(actor => actor.actorId)
  ))

  const vendorIds = Array.from(new Set(
    actors.filter(actor => actor.actorRole === 'vendor').map(actor => actor.actorId)
  ))

  const [adminNameMap, vendors] = await Promise.all([
    getAdminDisplayNameMap(adminIds),
    vendorIds.length > 0
      ? Vendor.find({ vendorId: { $in: vendorIds } }).select('vendorId displayName legalName')
      : Promise.resolve([])
  ])

  const actorMap = new Map<string, string>()

  for (const [adminId, name] of adminNameMap.entries()) {
    actorMap.set(`admin:${adminId}`, name)
  }

  for (const vendor of vendors as Array<{ vendorId: string, displayName?: string, legalName?: string }>) {
    const display = vendor.displayName?.trim() || vendor.legalName?.trim() || vendor.vendorId
    actorMap.set(`vendor:${vendor.vendorId}`, display)
  }

  return actorMap
}
