interface VendorProfile {
  vendorId: string
  legalName: string
  displayName: string
  email: string
  status: 'active' | 'inactive'
  approvedVendorId?: string
  phone?: string
}

interface LoginResponse {
  token: string
  vendor: VendorProfile
}

interface RegisterResponse {
  message: string
  vendor: {
    vendorId: string
    legalName: string
    displayName: string
    email: string
    autoLinked: boolean
  }
}

const STORAGE_TOKEN_KEY = 'booksuey.vendor.token'
const STORAGE_VENDOR_KEY = 'booksuey.vendor.profile'

export function useVendorAuth() {
  const token = useState<string | null>('vendor-auth-token', () => null)
  const vendor = useState<VendorProfile | null>('vendor-auth-vendor', () => null)
  const initialized = useState<boolean>('vendor-auth-initialized', () => false)

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
      localStorage.setItem(STORAGE_TOKEN_KEY, token.value)
    } else {
      localStorage.removeItem(STORAGE_TOKEN_KEY)
    }

    if (vendor.value) {
      localStorage.setItem(STORAGE_VENDOR_KEY, JSON.stringify(vendor.value))
    } else {
      localStorage.removeItem(STORAGE_VENDOR_KEY)
    }
  }

  function clearSession(): void {
    token.value = null
    vendor.value = null
    persistSession()
  }

  function applySession(payload: LoginResponse): void {
    token.value = payload.token
    vendor.value = payload.vendor
    persistSession()
  }

  function initializeFromStorage(): void {
    if (initialized.value || !import.meta.client) {
      return
    }

    const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY)
    const storedVendor = localStorage.getItem(STORAGE_VENDOR_KEY)

    token.value = storedToken || null

    if (storedVendor) {
      try {
        vendor.value = JSON.parse(storedVendor) as VendorProfile
      } catch {
        vendor.value = null
      }
    }

    initialized.value = true
  }

  async function fetchMe(): Promise<boolean> {
    if (!token.value) {
      return false
    }

    try {
      const response = await $fetch<{ vendor: VendorProfile }>('/api/vendor/me', {
        method: 'GET',
        headers: authHeaders()
      })

      vendor.value = response.vendor
      persistSession()
      return true
    } catch {
      clearSession()
      return false
    }
  }

  async function ensureInitialized(): Promise<void> {
    initializeFromStorage()

    if (token.value && !vendor.value) {
      await fetchMe()
    }
  }

  async function login(payload: { email: string, password: string }): Promise<LoginResponse> {
    const response = await $fetch<LoginResponse>('/api/vendor/login', {
      method: 'POST',
      body: payload
    })

    applySession(response)

    return response
  }

  async function register(payload: {
    legalName: string
    displayName: string
    email: string
    phone?: string
    password: string
  }): Promise<RegisterResponse> {
    return await $fetch<RegisterResponse>('/api/vendor/register', {
      method: 'POST',
      body: payload
    })
  }

  async function logout(): Promise<void> {
    const currentToken = token.value

    try {
      if (currentToken) {
        await $fetch('/api/vendor/logout', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${currentToken}`
          }
        })
      }
    } finally {
      clearSession()
    }
  }

  return {
    token,
    vendor,
    initialized,
    authHeaders,
    ensureInitialized,
    fetchMe,
    login,
    register,
    logout,
    applySession,
    clearSession
  }
}
