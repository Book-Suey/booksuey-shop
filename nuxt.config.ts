// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    mongodbUri: process.env.MONGODB_URI,
    jwtSecret: process.env.JWT_SECRET,
    bcryptCostFactor: parseInt(process.env.BCRYPT_COST_FACTOR || '12', 10)
  },

  routeRules: {
    '/admin/login': { redirect: '/login' }
  },

  compatibilityDate: '2025-01-15',

  nitro: {
    preset: 'node-server'
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
