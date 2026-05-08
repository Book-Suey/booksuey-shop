export default defineNuxtRouteMiddleware(async (to) => {
  const vendorAuth = useVendorAuth()
  const adminAuth = useAdminAuth()

  await Promise.all([vendorAuth.ensureInitialized(), adminAuth.ensureInitialized()])

  // Recovery and success-transition routes must remain accessible for reset and UI review flows.
  if (to.path === '/forgot-password' || to.path === '/reset-password' || to.path === '/auth-success') {
    return
  }

  if (adminAuth.token.value) {
    const hasValidAdminSession = await adminAuth.fetchMe()

    if (hasValidAdminSession) {
      return navigateTo('/admin')
    }
  }

  if (!vendorAuth.token.value) {
    return
  }

  const hasValidSession = await vendorAuth.fetchMe()

  if (!hasValidSession) {
    return
  }

  return navigateTo('/vendor')
})
