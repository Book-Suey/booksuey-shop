import { z } from 'zod'
import { connectToDatabase } from '../../config/database'
import { PaymentDisbursement } from '../../models/PaymentDisbursement'
import { requireAdmin } from '../../utils/adminAuth'
import { checkPayoutStatus, reconcileOutstandingPayouts } from '../../utils/payoutReconciliation'

const payoutRecoverySchema = z.object({
  action: z.enum(['reconcile', 'recheck']),
  payoutRequestId: z.string().trim().min(1).optional(),
  disbursementId: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(500).optional()
})

export default defineEventHandler(async (event) => {
  const adminIdentity = await requireAdmin(event)
  await connectToDatabase()

  const body = await readBody(event)
  const parsedBody = payoutRecoverySchema.safeParse(body)

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid payout recovery request payload'
    })
  }

  const payload = parsedBody.data

  if (payload.action === 'reconcile') {
    const results = await reconcileOutstandingPayouts({
      payoutRequestId: payload.payoutRequestId,
      disbursementId: payload.disbursementId,
      limit: payload.limit,
      actorId: adminIdentity.actorId
    })

    return {
      action: 'reconcile',
      reconciledCount: results.length,
      updatedCount: results.filter(result => result.changed).length,
      results
    }
  }

  if (!payload.disbursementId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'disbursementId is required for recheck action'
    })
  }

  const disbursement = await PaymentDisbursement.findOne({ disbursementId: payload.disbursementId })
  if (!disbursement) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Disbursement not found'
    })
  }

  const result = await checkPayoutStatus({
    disbursementId: disbursement.disbursementId,
    payoutRequestId: disbursement.payoutRequestId,
    providerReferenceId: disbursement.providerReferenceId,
    providerItemId: disbursement.providerItemId,
    localStatus: disbursement.status,
    actorId: adminIdentity.actorId
  })

  return {
    action: 'recheck',
    result
  }
})
