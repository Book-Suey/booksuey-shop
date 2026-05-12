import { SaleRecord } from '../../../../models/SaleRecord'
import { ApprovedVendor } from '../../../../models/ApprovedVendor'
import { Vendor } from '../../../../models/Vendor'
import { requireAdmin } from '../../../../utils/adminAuth'
import { connectToDatabase } from '../../../../config/database'

interface VendorSummary {
  approvedVendorId: string
  approvedVendorName: string
  isLinked: boolean
  count: number
  totalCommission: string
}

interface ApprovedVendorInfo {
  firstName: string
  lastName: string
}

interface ApprovedVendorDoc {
  basilId: string
  firstName: string
  lastName: string
}

function toTrimmedId(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function normalizeId(value: unknown): string {
  return toTrimmedId(value).toLowerCase()
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const batchId = getRouterParam(event, 'batchId')

  try {
    // Get all sales records for this batch
    const saleRecords = await SaleRecord.find({
      sourceBatchId: batchId
    }).lean()

    // Group incoming rows by their stored approvedVendorId value first.
    const sourceGroups = new Map<string, {
      count: number
      totalCommission: number
    }>()

    for (const record of saleRecords) {
      const sourceApprovedVendorId = toTrimmedId(record.approvedVendorId) || 'unmapped'

      if (!sourceGroups.has(sourceApprovedVendorId)) {
        sourceGroups.set(sourceApprovedVendorId, {
          count: 0,
          totalCommission: 0
        })
      }

      const group = sourceGroups.get(sourceApprovedVendorId)!
      group.count += 1
      group.totalCommission += Number.parseFloat(record.commissionAmount || '0')
    }

    // Resolve each source key to an approved vendor id first.
    const sourceKeys = Array.from(sourceGroups.keys()).filter(id => id !== 'unmapped')
    const vendorsByVendorId = await Vendor.find({
      vendorId: { $in: sourceKeys }
    })
      .select('vendorId approvedVendorId')
      .lean()

    const approvedVendorIdByVendorId = new Map<string, string>(
      (vendorsByVendorId as Array<{ vendorId: string, approvedVendorId?: string }>).map(
        vendor => [toTrimmedId(vendor.vendorId), toTrimmedId(vendor.approvedVendorId) || toTrimmedId(vendor.vendorId)]
      )
    )

    const approvedVendors = await ApprovedVendor.find({}).select('basilId firstName lastName').lean()

    const approvedVendorCanonicalIdByNormalizedId = new Map<string, string>()
    const approvedVendorInfoByCanonicalId = new Map<string, ApprovedVendorInfo>()

    for (const approvedVendor of approvedVendors as ApprovedVendorDoc[]) {
      const canonicalBasilId = toTrimmedId(approvedVendor.basilId)
      if (!canonicalBasilId) {
        continue
      }

      approvedVendorCanonicalIdByNormalizedId.set(
        normalizeId(canonicalBasilId),
        canonicalBasilId
      )
      approvedVendorInfoByCanonicalId.set(canonicalBasilId, {
        firstName: approvedVendor.firstName,
        lastName: approvedVendor.lastName
      })
    }

    function resolveApprovedVendorId(sourceKey: string): string {
      const trimmedSourceKey = toTrimmedId(sourceKey)

      const sourceKeyCanonical = approvedVendorCanonicalIdByNormalizedId.get(normalizeId(sourceKey))
      if (sourceKeyCanonical) {
        return sourceKeyCanonical
      }

      const mappedVendorId = approvedVendorIdByVendorId.get(trimmedSourceKey)
      if (!mappedVendorId) {
        return trimmedSourceKey
      }

      return approvedVendorCanonicalIdByNormalizedId.get(normalizeId(mappedVendorId)) || mappedVendorId
    }

    // Re-aggregate into approved-vendor buckets, then apply linked/unlinked
    // status based on whether a vendor account exists for that approved vendor.
    const summaryByApprovedVendorId = new Map<string, {
      count: number
      totalCommission: number
    }>()

    for (const [sourceKey, group] of sourceGroups.entries()) {
      if (sourceKey === 'unmapped') {
        continue
      }

      const approvedVendorId = resolveApprovedVendorId(sourceKey)
      const current = summaryByApprovedVendorId.get(approvedVendorId)

      if (current) {
        current.count += group.count
        current.totalCommission += group.totalCommission
      } else {
        summaryByApprovedVendorId.set(approvedVendorId, {
          count: group.count,
          totalCommission: group.totalCommission
        })
      }
    }

    const resolvedApprovedVendorIds = Array.from(summaryByApprovedVendorId.keys())
    const linkedVendors = await Vendor.find({
      approvedVendorId: { $in: resolvedApprovedVendorIds }
    }).select('approvedVendorId').lean()
    const linkedApprovedVendorIdsNormalized = new Set(
      (linkedVendors as Array<{ approvedVendorId?: string }>)
        .map(vendor => vendor.approvedVendorId)
        .filter((approvedVendorId): approvedVendorId is string => Boolean(approvedVendorId))
        .map(approvedVendorId => normalizeId(approvedVendorId))
    )

    const summary: VendorSummary[] = Array.from(summaryByApprovedVendorId.entries()).map(
      ([approvedVendorId, group]) => {
        const approvedVendorInfo = approvedVendorInfoByCanonicalId.get(approvedVendorId)
          || approvedVendorInfoByCanonicalId.get(
            approvedVendorCanonicalIdByNormalizedId.get(normalizeId(approvedVendorId)) || ''
          )
          || undefined
        const approvedVendorName = approvedVendorInfo
          ? `${approvedVendorInfo.firstName} ${approvedVendorInfo.lastName}`
          : 'Unknown vendor'

        return {
          approvedVendorId,
          approvedVendorName,
          isLinked: linkedApprovedVendorIdsNormalized.has(normalizeId(approvedVendorId)),
          count: group.count,
          totalCommission: group.totalCommission.toFixed(2)
        }
      }
    )

    // Sort by count descending
    summary.sort((a, b) => b.count - a.count)

    return { summary }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Unable to load import summary'
    })
  }
})
