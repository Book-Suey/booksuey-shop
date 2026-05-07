export default defineNuxtRouteMiddleware(async () => {
  const auth = useVendorAuth()

  await auth.ensureInitialized()

  if (!auth.token.value) {
    return navigateTo('/login')
  }

  if (!auth.vendor.value) {
    const isValid = await auth.fetchMe()
    if (!isValid) {
      return navigateTo('/login')
    }
  }
})
