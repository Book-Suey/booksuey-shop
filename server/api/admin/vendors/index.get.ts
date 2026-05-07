import { z } from 'zod'
import { connectToDatabase } from '../../../config/database'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'

const vendorsQuerySchema = z.object({
  status: z.enum(['active', 'inactive']).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const query = getQuery(event)
  const parsed = vendorsQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid query parameters'
    })
  }

  const filter = parsed.data.status
    ? { status: parsed.data.status }
    : {}

  const vendors = await Vendor.find(filter)
    .select('-passwordHash -passwordResetToken -passwordResetExpires')
    .sort({ createdAt: -1 })

  return {
    vendors
  }
})
