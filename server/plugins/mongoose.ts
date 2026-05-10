import { connectToDatabase } from '../config/database'

export default defineNitroPlugin(() => {
  if (process.env.NETLIFY || process.env.NITRO_PRESET === 'netlify') {
    return
  }

  void connectToDatabase().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`MongoDB startup connection skipped: ${message}`)
  })
})
