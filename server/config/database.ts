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

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (mongooseConnection && mongoose.connection.readyState === 1) {
    return mongooseConnection
  }

  const config = getMongooseConfig()
  mongooseConnection = await mongoose.connect(config.uri, config.options)
  return mongooseConnection
}

export function getMongoose(): typeof mongoose {
  if (!mongooseConnection) {
    throw new Error('Database not connected. Call connectToDatabase() first.')
  }
  return mongooseConnection
}
