import { z } from 'zod'
import { Vendor } from '../../models/Vendor'
import { AdminAccount } from '../../models/AdminAccount'
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

  if (vendor) {
    return { valid: true, email: vendor.email, role: 'vendor' as const }
  }

  const admin = await AdminAccount.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: new Date() }
  })

  if (admin) {
    return { valid: true, email: admin.email, role: 'admin' as const }
  }

  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid or expired reset token'
  })
})
