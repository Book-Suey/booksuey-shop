import { connectToDatabase } from '../../../config/database'
import { ApprovedVendor } from '../../../models/ApprovedVendor'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const approvedVendors = await ApprovedVendor.find({}).sort({ lastName: 1, firstName: 1 })

  return {
    approvedVendors
  }
})
