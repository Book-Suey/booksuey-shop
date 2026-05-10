import Decimal from 'decimal.js'
import { LedgerEntry } from '../models/LedgerEntry'
import { BalanceSnapshot } from '../models/BalanceSnapshot'
import type { ILedgerEntry } from '../models/LedgerEntry'

export type BalanceEntryType = 'sale' | 'reservation' | 'release' | 'paid'

type RunningBalance = {
  pendingAmount: Decimal
  availableAmount: Decimal
  paidAmount: Decimal
}

function createZeroBalance(): RunningBalance {
  return {
    pendingAmount: new Decimal(0),
    availableAmount: new Decimal(0),
    paidAmount: new Decimal(0)
  }
}

export function applyLedgerEntryToBalance(balance: RunningBalance, entry: {
  entryType: BalanceEntryType
  amount: string
}): RunningBalance {
  const amount = new Decimal(entry.amount)

  if (entry.entryType === 'sale') {
    balance.availableAmount = balance.availableAmount.plus(amount)
  }

  if (entry.entryType === 'reservation') {
    balance.availableAmount = balance.availableAmount.minus(amount)
    balance.pendingAmount = balance.pendingAmount.plus(amount)
  }

  if (entry.entryType === 'release') {
    balance.availableAmount = balance.availableAmount.plus(amount)
    balance.pendingAmount = balance.pendingAmount.minus(amount)
  }

  if (entry.entryType === 'paid') {
    balance.pendingAmount = balance.pendingAmount.minus(amount)
    balance.paidAmount = balance.paidAmount.plus(amount)
  }

  return balance
}

export function getLedgerEntryBalanceImpact(entryType: BalanceEntryType, amount: string): string {
  const decimalAmount = new Decimal(amount)

  if (entryType === 'sale' || entryType === 'release') {
    return decimalAmount.toFixed(2)
  }

  return decimalAmount.negated().toFixed(2)
}

export async function recomputeBalanceSnapshot(vendorId: string, approvedVendorId?: string): Promise<{
  vendorId: string
  pendingAmount: string
  availableAmount: string
  paidAmount: string
  asOf: Date
}> {
  const ledgerScopeQuery = approvedVendorId
    ? {
        $or: [
          { vendorId },
          { approvedVendorId }
        ]
      }
    : { vendorId }

  const entries = await LedgerEntry.find(ledgerScopeQuery).sort({ occurredAt: 1, _id: 1 }) as ILedgerEntry[]

  const balance = createZeroBalance()

  for (const entry of entries) {
    applyLedgerEntryToBalance(balance, {
      entryType: entry.entryType,
      amount: entry.amount.toString()
    })
  }

  const snapshot = {
    vendorId,
    pendingAmount: balance.pendingAmount.toFixed(2),
    availableAmount: balance.availableAmount.toFixed(2),
    paidAmount: balance.paidAmount.toFixed(2),
    asOf: new Date()
  }

  await BalanceSnapshot.findOneAndUpdate(
    { vendorId },
    {
      vendorId,
      pendingAmount: snapshot.pendingAmount,
      availableAmount: snapshot.availableAmount,
      paidAmount: snapshot.paidAmount,
      asOf: snapshot.asOf
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  )

  return snapshot
}

export async function recomputeBalanceSnapshotsForVendors(vendorIds: string[]): Promise<void> {
  const uniqueVendorIds = Array.from(new Set(vendorIds))

  for (const vendorId of uniqueVendorIds) {
    await recomputeBalanceSnapshot(vendorId)
  }
}
