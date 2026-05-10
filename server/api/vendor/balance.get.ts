import { connectToDatabase } from '../../config/database'
import { recomputeBalanceSnapshot } from '../../utils/balance'
import { requireVendorScope } from '../../utils/vendorContext'

export default defineEventHandler(async (event) => {
  await connectToDatabase()

  const vendorScope = requireVendorScope(event)
  const snapshot = await recomputeBalanceSnapshot(
    vendorScope.vendorId,
    vendorScope.approvedVendorId
  )

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
