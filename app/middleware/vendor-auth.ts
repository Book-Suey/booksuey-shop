export default defineNuxtRouteMiddleware(async () => {
  // Vendor session is stored in localStorage, which is unavailable during SSR.
  // Defer guard enforcement to the client where session hydration can occur.
  if (import.meta.server) {
    return
  }

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
