export default defineNuxtRouteMiddleware(async () => {
  const auth = useVendorAuth()

  await auth.ensureInitialized()

  if (auth.token.value) {
    return navigateTo('/')
  }
})
