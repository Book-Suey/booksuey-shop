import { connectToDatabase } from '../../config/database'
import { recomputeBalanceSnapshot } from '../../utils/balance'
import { requireVendorId } from '../../utils/vendorContext'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorId = requireVendorId(event)
  const snapshot = await recomputeBalanceSnapshot(vendorId)

  return {
    balance: {
      vendorId: snapshot.vendorId,
      pendingAmount: snapshot.pendingAmount,
      availableAmount: snapshot.availableAmount,
      paidAmount: snapshot.paidAmount,
      asOf: snapshot.asOf
    }
  }
})
