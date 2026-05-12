interface AdminProfile {
  adminId: string
  displayName: string
  email: string
  status: 'active' | 'disabled'
  lastLoginAt?: string
}

interface AdminSessionPayload {
  token: string
  admin: AdminProfile
}

const ADMIN_PROFILE_COOKIE = 'booksuey.admin.profile'

export function useAdminAuth() {
  // The JWT token is stored as an httpOnly cookie set by the server on login.
  // JavaScript cannot read it; the browser and Nuxt's SSR fetch layer forward it automatically.
  // The profile is stored in a regular (non-httpOnly) cookie so it can be read on both
  // server (during SSR) and client (for display and session checks).
  const adminProfileCookie = useCookie<AdminProfile | null>(ADMIN_PROFILE_COOKIE, {
    default: () => null,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  })

  const admin = useState<AdminProfile | null>('admin-auth-profile', () => adminProfileCookie.value)
  const initialized = useState<boolean>('admin-auth-initialized', () => false)

  // Derived "token" ref kept for backward compatibility with middleware/guest checks.
  // Callers only test truthiness; the actual JWT value is never exposed to client-side JS.
  const token = computed(() => admin.value ? 'authenticated' : null)

  function authHeaders(): Record<string, string> {
    // The token is now forwarded automatically as an httpOnly cookie.
    // This method is kept so existing client-side mutation call sites need no changes.
    return {}
  }

  function clearSession(): void {
    admin.value = null
    adminProfileCookie.value = null
    initialized.value = false

    if (import.meta.client) {
      // Ask the server to clear the httpOnly cookie and revoke the token.
      $fetch('/api/auth/admin-logout', { method: 'POST' }).catch(() => {})
    }
  }

  function applySession(payload: AdminSessionPayload): void {
    // The server set the httpOnly token cookie in the login response.
    // We only need to persist the profile here for client-side display and session checks.
    admin.value = payload.admin
    adminProfileCookie.value = payload.admin
  }

  async function fetchMe(): Promise<boolean> {
    try {
      // No Authorization header needed — the httpOnly cookie is forwarded automatically
      // by the browser on the client and by Nuxt's request context on the server.
      const response = await $fetch<{ admin: AdminProfile }>('/api/admin/me', {
        method: 'GET'
      })

      admin.value = response.admin
      adminProfileCookie.value = response.admin
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function ensureInitialized(): Promise<void> {
    if (initialized.value) {
      return
    }

    // useCookie is SSR-safe — the profile cookie is available in both server and client contexts.
    if (adminProfileCookie.value) {
      admin.value = adminProfileCookie.value
    }

    initialized.value = true

    // If the profile is not cached but a valid httpOnly token cookie may still exist
    // (e.g. after a hard refresh that cleared other storage), verify via the API.
    if (!admin.value) {
      await fetchMe()
    }
  }

  async function logout(): Promise<void> {
    clearSession()
  }

  return {
    token,
    admin,
    initialized,
    authHeaders,
    ensureInitialized,
    fetchMe,
    logout,
    applySession,
    clearSession
  }
}
