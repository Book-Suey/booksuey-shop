import { connectToDatabase } from '../../config/database'
import { AdminAccount } from '../../models/AdminAccount'
import { requireAdmin } from '../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const admin = await AdminAccount.findOne({
    adminId: adminIdentity.actorId,
    status: 'active'
  }).select('-passwordHash -passwordResetToken -passwordResetExpires')

  if (!admin) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Admin not found or inactive'
    })
  }

  return {
    admin: {
      adminId: admin.adminId,
      email: admin.email,
      status: admin.status,
      lastLoginAt: admin.lastLoginAt,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    }
  }
})
