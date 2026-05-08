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

const ADMIN_STORAGE_TOKEN_KEY = 'booksuey.admin.token'
const ADMIN_STORAGE_PROFILE_KEY = 'booksuey.admin.profile'

export function useAdminAuth() {
  const token = useState<string | null>('admin-auth-token', () => null)
  const admin = useState<AdminProfile | null>('admin-auth-profile', () => null)
  const initialized = useState<boolean>('admin-auth-initialized', () => false)

  function authHeaders(): Record<string, string> {
    if (!token.value) {
      return {}
    }

    return {
      authorization: `Bearer ${token.value}`
    }
  }

  function persistSession(): void {
    if (!import.meta.client) {
      return
    }

    if (token.value) {
      localStorage.setItem(ADMIN_STORAGE_TOKEN_KEY, token.value)
    } else {
      localStorage.removeItem(ADMIN_STORAGE_TOKEN_KEY)
    }

    if (admin.value) {
      localStorage.setItem(ADMIN_STORAGE_PROFILE_KEY, JSON.stringify(admin.value))
    } else {
      localStorage.removeItem(ADMIN_STORAGE_PROFILE_KEY)
    }
  }

  function clearSession(): void {
    token.value = null
    admin.value = null
    persistSession()
  }

  function applySession(payload: AdminSessionPayload): void {
    token.value = payload.token
    admin.value = payload.admin
    persistSession()
  }

  function initializeFromStorage(): void {
    if (initialized.value || !import.meta.client) {
      return
    }

    const storedToken = localStorage.getItem(ADMIN_STORAGE_TOKEN_KEY)
    const storedProfile = localStorage.getItem(ADMIN_STORAGE_PROFILE_KEY)

    token.value = storedToken || null

    if (storedProfile) {
      try {
        admin.value = JSON.parse(storedProfile) as AdminProfile
      } catch {
        admin.value = null
      }
    }

    initialized.value = true
  }

  async function fetchMe(): Promise<boolean> {
    if (!token.value) {
      return false
    }

    try {
      const response = await $fetch<{ admin: AdminProfile }>('/api/admin/me', {
        method: 'GET',
        headers: authHeaders()
      })

      admin.value = response.admin
      persistSession()
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function ensureInitialized(): Promise<void> {
    initializeFromStorage()

    if (token.value && !admin.value) {
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
