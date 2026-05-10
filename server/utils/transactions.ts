import mongoose, { type ClientSession } from 'mongoose'

function isTransactionUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  // Capped collections (like AuditEvent) cannot be written inside transactions.
  // In that case, rerun the workflow without a transaction.
  const isCappedCollectionTxnError
    = message.includes('capped collection')
      && message.includes('Writes in transactions are not allowed')

  return (
    message.includes('Transaction numbers are only allowed on a replica set member or mongos')
    || (message.includes('transaction') && message.includes('not supported'))
    || isCappedCollectionTxnError
  )
}

export async function runWithOptionalTransaction<T>(
  work: (session?: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession()

  try {
    let result: T | undefined

    await session.withTransaction(async () => {
      result = await work(session)
    })

    if (result === undefined) {
      throw new Error('Transaction completed without returning a result')
    }

    return result
  } catch (error) {
    if (isTransactionUnsupportedError(error)) {
      return work()
    }

    throw error
  } finally {
    await session.endSession()
  }
}
