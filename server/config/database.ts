import mongoose from 'mongoose'

export interface MongooseConfig {
  uri: string
  options?: mongoose.ConnectOptions
}

export function getMongooseConfig(): MongooseConfig {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment')
  }

  return {
    uri,
    options: {
      // MongoDB connection options
    }
  }
}

let mongooseConnection: typeof mongoose | null = null
let mongooseConnectionPromise: Promise<typeof mongoose> | null = null

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongooseConnection && mongoose.connection.readyState === 1) {
    return mongooseConnection
  }

  if (mongooseConnectionPromise) {
    return mongooseConnectionPromise
  }

  const config = getMongooseConfig()

  mongooseConnectionPromise = mongoose.connect(config.uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    ...config.options
  })

  try {
    mongooseConnection = await mongooseConnectionPromise
    return mongooseConnection
  } catch (error) {
    mongooseConnectionPromise = null
    mongooseConnection = null
    throw error
  }
}

export function getMongoose(): typeof mongoose {
  if (!mongooseConnection) {
    throw new Error('Database not connected. Call connectToDatabase() first.')
  }
  return mongooseConnection
}
