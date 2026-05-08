export default defineNuxtRouteMiddleware(async () => {
  // Admin session is stored in localStorage, which is unavailable during SSR.
  // Defer guard enforcement to the client where session hydration can occur.
  if (import.meta.server) {
    return
  }

  const adminAuth = useAdminAuth()

  await adminAuth.ensureInitialized()

  if (!adminAuth.token.value) {
    return navigateTo('/login')
  }

  if (!adminAuth.admin.value) {
    const isValid = await adminAuth.fetchMe()
    if (!isValid) {
      return navigateTo('/login')
    }
  }
})
