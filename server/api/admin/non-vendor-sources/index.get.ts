import { connectToDatabase } from '../../../config/database'
import { VerifiedNonVendorSource } from '../../../models/VerifiedNonVendorSource'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const nonVendorSources = await VerifiedNonVendorSource.find({}).sort({ sourceName: 1 })

  return {
    nonVendorSources: nonVendorSources.map((source: {
      sourceName: string
      normalizedSource: string
      createdAt: Date
      updatedAt: Date
    }) => ({
      sourceName: source.sourceName,
      normalizedSource: source.normalizedSource,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt
    }))
  }
})
