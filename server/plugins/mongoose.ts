import { connectToDatabase } from '../config/database'

export default defineNitroPlugin(async () => {
  // Connect to database on server startup
  await connectToDatabase()
})
