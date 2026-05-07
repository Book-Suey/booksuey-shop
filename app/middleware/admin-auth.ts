export default defineNuxtRouteMiddleware(async () => {
  const adminAuth = useAdminAuth()

  await adminAuth.ensureInitialized()

  if (!adminAuth.token.value) {
    return navigateTo('/admin/login')
  }

  if (!adminAuth.admin.value) {
    const isValid = await adminAuth.fetchMe()
    if (!isValid) {
      return navigateTo('/admin/login')
    }
  }
})
