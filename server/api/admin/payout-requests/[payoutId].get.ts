import { connectToDatabase } from '../../../config/database'
import { LedgerEntry } from '../../../models/LedgerEntry'
import type { ILedgerEntry } from '../../../models/LedgerEntry'
import { PaymentDisbursement } from '../../../models/PaymentDisbursement'
import { PayoutRequest } from '../../../models/PayoutRequest'
import { Vendor } from '../../../models/Vendor'
import { requireAdmin } from '../../../utils/adminAuth'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await connectToDatabase()

  const payoutId = getRouterParam(event, 'payoutId')
  if (!payoutId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Payout identifier is required'
    })
  }

  const payoutRequest = await PayoutRequest.findOne({ payoutRequestId: payoutId })
  if (!payoutRequest) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Payout request not found'
    })
  }

  const vendor = await Vendor.findOne({ vendorId: payoutRequest.vendorId })
  const disbursement = await PaymentDisbursement.findOne({ payoutRequestId: payoutId }).sort({ createdAt: -1 })
  const ledgerEntries = await LedgerEntry.find({
    referenceType: 'PayoutRequest',
    referenceId: payoutId
  }).sort({ occurredAt: -1 })

  return {
    payoutRequest: {
      payoutRequestId: payoutRequest.payoutRequestId,
      vendorId: payoutRequest.vendorId,
      vendorName: vendor?.displayName || vendor?.legalName || 'Unknown Vendor',
      amount: payoutRequest.amount.toString(),
      currency: payoutRequest.currency,
      status: payoutRequest.status,
      requestedAt: payoutRequest.requestedAt,
      approvedAt: payoutRequest.approvedAt,
      rejectedAt: payoutRequest.rejectedAt,
      rejectionReason: payoutRequest.rejectionReason,
      reviewedBy: payoutRequest.reviewedBy,
      reviewNote: payoutRequest.reviewNote,
      disbursingAt: payoutRequest.disbursingAt,
      paidAt: payoutRequest.paidAt,
      failedAt: payoutRequest.failedAt,
      createdAt: payoutRequest.createdAt,
      updatedAt: payoutRequest.updatedAt
    },
    disbursement: disbursement
      ? {
          disbursementId: disbursement.disbursementId,
          methodType: disbursement.methodType,
          providerReferenceId: disbursement.providerReferenceId,
          status: disbursement.status,
          disbursedAt: disbursement.disbursedAt,
          failureReason: disbursement.failureReason,
          createdAt: disbursement.createdAt,
          updatedAt: disbursement.updatedAt
        }
      : null,
    vendor: vendor
      ? {
          preferredPayoutMethod: vendor.preferredPayoutMethod,
          paypalEmail: vendor.paypalEmail,
          venmoHandle: vendor.venmoHandle
        }
      : null,
    ledgerEntries: ledgerEntries.map((entry: ILedgerEntry) => ({
      entryId: entry.entryId,
      entryType: entry.entryType,
      amount: entry.amount.toString(),
      currency: entry.currency,
      occurredAt: entry.occurredAt
    }))
  }
})
