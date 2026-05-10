import crypto from 'crypto'
import { AuditEvent } from '../models/AuditEvent'
import { LedgerEntry } from '../models/LedgerEntry'
import { PaymentDisbursement } from '../models/PaymentDisbursement'
import { PayoutRequest } from '../models/PayoutRequest'
import { Vendor } from '../models/Vendor'
import { runWithOptionalTransaction } from './transactions'

export interface DisbursementSettlementInput {
  disbursementId: string
  payoutRequestId: string
  vendorId: string
  amount: string
  occurredAt: Date
  actorId: string
  failureReason?: string
}

function createAuditId(): string {
  return `audit_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`
}

export async function settleDisbursementPaid(input: DisbursementSettlementInput): Promise<void> {
  await runWithOptionalTransaction(async (session) => {
    const disbursement = await PaymentDisbursement.findOne({ disbursementId: input.disbursementId }, undefined, { session })
    if (!disbursement || disbursement.status === 'paid') {
      return
    }

    await PaymentDisbursement.updateOne(
      { disbursementId: input.disbursementId, status: { $in: ['disbursing', 'failed'] } },
      {
        $set: {
          status: 'paid',
          disbursedAt: input.occurredAt,
          failureReason: undefined
        }
      },
      { session }
    )

    await PayoutRequest.updateOne(
      { payoutRequestId: input.payoutRequestId, status: { $in: ['disbursing', 'failed'] } },
      {
        $set: {
          status: 'paid',
          paidAt: input.occurredAt,
          failedAt: undefined
        }
      },
      { session }
    )

    const vendor = await Vendor.findOne({ vendorId: input.vendorId }, undefined, { session })
    const approvedVendorId = vendor?.approvedVendorId || input.vendorId

    const existingLedger = await LedgerEntry.findOne({ entryId: `ledger_paid_${input.payoutRequestId}` }, undefined, { session })

    if (!existingLedger) {
      await LedgerEntry.create([{
        entryId: `ledger_paid_${input.payoutRequestId}`,
        vendorId: input.vendorId,
        approvedVendorId,
        entryType: 'paid',
        amount: input.amount,
        currency: 'USD',
        referenceType: 'PayoutRequest',
        referenceId: input.payoutRequestId,
        occurredAt: input.occurredAt
      }], { session })
    }

    await AuditEvent.create([{
      auditEventId: createAuditId(),
      actorId: input.actorId,
      actorRole: 'admin',
      action: 'disbursement_completed',
      entityType: 'PaymentDisbursement',
      entityId: input.disbursementId,
      after: {
        payoutRequestId: input.payoutRequestId,
        status: 'paid',
        disbursedAt: input.occurredAt
      },
      createdAt: input.occurredAt
    }], { session })
  })
}

export async function settleDisbursementFailed(input: DisbursementSettlementInput): Promise<void> {
  await runWithOptionalTransaction(async (session) => {
    const disbursement = await PaymentDisbursement.findOne({ disbursementId: input.disbursementId }, undefined, { session })
    if (!disbursement || disbursement.status === 'paid') {
      return
    }

    const failureReason = input.failureReason || 'Payout failed at provider'

    await PaymentDisbursement.updateOne(
      { disbursementId: input.disbursementId, status: { $in: ['disbursing', 'failed'] } },
      {
        $set: {
          status: 'failed',
          disbursedAt: input.occurredAt,
          failureReason
        }
      },
      { session }
    )

    await PayoutRequest.updateOne(
      { payoutRequestId: input.payoutRequestId, status: { $in: ['disbursing', 'failed'] } },
      {
        $set: {
          status: 'failed',
          failedAt: input.occurredAt
        }
      },
      { session }
    )

    const vendor = await Vendor.findOne({ vendorId: input.vendorId }, undefined, { session })
    const approvedVendorId = vendor?.approvedVendorId || input.vendorId

    const existingRelease = await LedgerEntry.findOne({ entryId: `ledger_release_${input.payoutRequestId}_failed` }, undefined, { session })
    if (!existingRelease) {
      await LedgerEntry.create([{
        entryId: `ledger_release_${input.payoutRequestId}_failed`,
        vendorId: input.vendorId,
        approvedVendorId,
        entryType: 'release',
        amount: input.amount,
        currency: 'USD',
        referenceType: 'PayoutRequest',
        referenceId: input.payoutRequestId,
        occurredAt: input.occurredAt
      }], { session })
    }

    await AuditEvent.create([{
      auditEventId: createAuditId(),
      actorId: input.actorId,
      actorRole: 'admin',
      action: 'disbursement_failed',
      entityType: 'PaymentDisbursement',
      entityId: input.disbursementId,
      after: {
        payoutRequestId: input.payoutRequestId,
        status: 'failed',
        disbursedAt: input.occurredAt,
        failureReason
      },
      createdAt: input.occurredAt
    }], { session })
  })
}
