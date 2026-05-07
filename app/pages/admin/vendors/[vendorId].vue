<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface VendorRecord {
  vendorId: string
  legalName: string
  displayName: string
  email: string
  phone?: string
  status: 'active' | 'inactive'
  approvedVendorId?: string
}

const route = useRoute()
const isSubmitting = ref(false)
const formError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const vendorId = computed(() => String(route.params.vendorId || ''))

const { data, pending, error, refresh } = await useAsyncData(
  'admin-vendor-detail',
  async () => {
    const response = await $fetch<{ vendor: VendorRecord }>(
      `/api/admin/vendors/${vendorId.value}`,
      {
        method: 'GET'
      }
    )

    return response.vendor
  },
  {
    server: false,
    watch: [vendorId],
    default: () => null
  }
)

const form = reactive({
  legalName: '',
  displayName: '',
  email: '',
  phone: '',
  status: 'active' as 'active' | 'inactive',
  approvedVendorId: '',
  password: ''
})

watch(
  data,
  (next) => {
    if (!next) {
      return
    }

    form.legalName = next.legalName
    form.displayName = next.displayName
    form.email = next.email
    form.phone = next.phone || ''
    form.status = next.status
    form.approvedVendorId = next.approvedVendorId || ''
    form.password = ''
  },
  { immediate: true }
)

async function submitUpdate(): Promise<void> {
  formError.value = null
  successMessage.value = null
  isSubmitting.value = true

  try {
    const payload: Record<string, string> = {
      legalName: form.legalName,
      displayName: form.displayName,
      email: form.email,
      phone: form.phone,
      status: form.status,
      approvedVendorId: form.approvedVendorId
    }

    if (!form.phone.trim()) {
      delete payload.phone
    }

    if (!form.approvedVendorId.trim()) {
      delete payload.approvedVendorId
    }

    if (form.password.trim()) {
      payload.password = form.password
    }

    const response = await $fetch<{ message: string }>(
      `/api/admin/vendors/${vendorId.value}`,
      {
        method: 'PATCH',
        body: payload
      }
    )

    successMessage.value = response.message
    form.password = ''
    await refresh()
  } catch (submitError: unknown) {
    const statusMessage = (submitError as { statusMessage?: string })
      ?.statusMessage
    formError.value = statusMessage || 'Unable to update vendor account.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">
        Admin vendor management
      </p>
      <h1 class="auth-title">
        Edit vendor account
      </h1>
      <p class="auth-copy">
        Update profile, status, and approved-vendor mapping for this vendor.
      </p>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading vendor"
      description="Fetching vendor details."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load vendor"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Request failed.'
      "
      @retry="refresh"
    />

    <article
      v-else
      class="vendor-panel"
    >
      <form
        class="auth-form"
        @submit.prevent="submitUpdate"
      >
        <label>
          <span>Legal name</span>
          <input
            v-model="form.legalName"
            required
            type="text"
          >
        </label>

        <label>
          <span>Display name</span>
          <input
            v-model="form.displayName"
            required
            type="text"
          >
        </label>

        <label>
          <span>Email</span>
          <input
            v-model="form.email"
            required
            type="email"
          >
        </label>

        <label>
          <span>Phone (optional)</span>
          <input
            v-model="form.phone"
            type="text"
          >
        </label>

        <label>
          <span>Status</span>
          <select v-model="form.status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label>
          <span>Approved vendor ID (optional)</span>
          <input
            v-model="form.approvedVendorId"
            type="text"
          >
        </label>

        <label>
          <span>Reset password (optional)</span>
          <input
            v-model="form.password"
            minlength="8"
            type="password"
            placeholder="Leave blank to keep current password"
          >
        </label>

        <p
          v-if="formError"
          class="auth-error"
        >
          {{ formError }}
        </p>

        <p
          v-if="successMessage"
          class="auth-success"
        >
          {{ successMessage }}
        </p>

        <div class="vendor-actions">
          <button
            type="submit"
            class="portal-button portal-button--primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "Saving..." : "Save changes" }}
          </button>
          <NuxtLink
            to="/admin/vendors"
            class="portal-button portal-button--secondary"
          >
            Back to list
          </NuxtLink>
        </div>
      </form>
    </article>
  </section>
</template>
