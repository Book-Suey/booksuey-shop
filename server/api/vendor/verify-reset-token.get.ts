import { z } from 'zod'
import { Vendor } from '../../models/Vendor'
import { connectToDatabase } from '../../config/database'

const verifySchema = z.object({
  token: z.string()
})

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const query = getQuery(event)
  const parsed = verifySchema.safeParse(query)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid token'
    })
  }

  const { token } = parsed.data

  const vendor = await Vendor.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() }
  })

  if (!vendor) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or expired reset token'
    })
  }

  return { valid: true, email: vendor.email }
})
