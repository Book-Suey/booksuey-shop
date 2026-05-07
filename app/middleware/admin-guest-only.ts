export default defineNuxtRouteMiddleware(async () => {
  const adminAuth = useAdminAuth()

  await adminAuth.ensureInitialized()

  if (adminAuth.token.value) {
    return navigateTo('/admin')
  }
})
