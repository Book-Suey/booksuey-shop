export default defineNuxtRouteMiddleware(async () => {
  const adminAuth = useAdminAuth()

  if (import.meta.server) {
    // The httpOnly token cookie is readable on the server via useCookie.
    // Check its presence here; the API endpoints perform full JWT validation.
    const tokenCookie = useCookie('booksuey-admin-token')
    if (!tokenCookie.value) {
      return navigateTo('/login')
    }

    return
  }

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
