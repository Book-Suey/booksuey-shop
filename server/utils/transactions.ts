import mongoose, { type ClientSession } from 'mongoose'

function isTransactionUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)

  return (
    message.includes('Transaction numbers are only allowed on a replica set member or mongos')
    || (message.includes('transaction') && message.includes('not supported'))
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
