// Test setup file
import { beforeAll } from 'vitest'

// Set test environment variables
process.env.JWT_SECRET = 'test-secret-key-for-tests'
process.env.JWT_EXPIRES_IN = '7d'
process.env.BCRYPT_COST_FACTOR = '12'
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test'

beforeAll(() => {
  // Setup runs before tests
})
