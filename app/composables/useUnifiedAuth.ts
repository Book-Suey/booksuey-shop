interface UnifiedAdminProfile {
  adminId: string
  displayName: string
  email: string
  status: 'active' | 'disabled'
  lastLoginAt?: string
}

interface UnifiedVendorProfile {
  vendorId: string
  legalName: string
  displayName: string
  email: string
  status: 'active' | 'inactive'
  approvedVendorId?: string
  phone?: string
}

type UnifiedLoginResponse
  = | {
    role: 'admin'
    token: string
    admin: UnifiedAdminProfile
  }
  | {
    role: 'vendor'
    token: string
    vendor: UnifiedVendorProfile
  }

export function useUnifiedAuth() {
  const vendorAuth = useVendorAuth()
  const adminAuth = useAdminAuth()

  async function login(payload: { email: string, password: string }): Promise<UnifiedLoginResponse> {
    const response = await $fetch<UnifiedLoginResponse>('/api/auth/login', {
      method: 'POST',
      body: payload
    })

    if (response.role === 'admin') {
      vendorAuth.clearSession()
      adminAuth.applySession({ token: response.token, admin: response.admin })

      return response
    }

    adminAuth.clearSession()
    vendorAuth.applySession({ token: response.token, vendor: response.vendor })

    return response
  }

  return {
    login
  }
}
