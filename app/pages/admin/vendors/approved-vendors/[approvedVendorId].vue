<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface ApprovedVendorRecord {
  basilId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

const route = useRoute()
const isSubmitting = ref(false)
const isDeleting = ref(false)
const formError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const approvedVendorId = computed(() =>
  String(route.params.approvedVendorId || '')
)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-approved-vendor-detail',
  async () => {
    const response = await $fetch<{ approvedVendors: ApprovedVendorRecord[] }>(
      '/api/admin/approved-vendors',
      {
        method: 'GET'
      }
    )

    const approvedVendor = response.approvedVendors.find(
      vendor => vendor.basilId === approvedVendorId.value
    )
    if (!approvedVendor) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Approved vendor not found'
      })
    }

    return approvedVendor
  },
  {
    server: false,
    watch: [approvedVendorId],
    default: () => null
  }
)

const form = reactive({
  basilId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
})

watch(
  data,
  (next) => {
    if (!next) {
      return
    }

    form.basilId = next.basilId
    form.firstName = next.firstName
    form.lastName = next.lastName
    form.email = next.email
    form.phone = next.phone || ''
  },
  { immediate: true }
)

async function submitUpdate(): Promise<void> {
  formError.value = null
  successMessage.value = null
  isSubmitting.value = true

  try {
    const response = await $fetch<{
      message: string
      approvedVendor: ApprovedVendorRecord
    }>(`/api/admin/approved-vendors/${approvedVendorId.value}`, {
      method: 'PATCH',
      body: {
        basilId: form.basilId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined
      }
    })

    successMessage.value = response.message
    if (response.approvedVendor.basilId !== approvedVendorId.value) {
      await navigateTo(
        `/admin/vendors/approved-vendors/${response.approvedVendor.basilId}`
      )
      return
    }

    await refresh()
  } catch (submitError: unknown) {
    const statusMessage = (submitError as { statusMessage?: string })
      ?.statusMessage
    formError.value = statusMessage || 'Unable to update approved vendor.'
  } finally {
    isSubmitting.value = false
  }
}

async function deleteRecord(): Promise<void> {
  if (!window.confirm('Delete this approved vendor record?')) {
    return
  }

  formError.value = null
  successMessage.value = null
  isDeleting.value = true

  try {
    await $fetch(`/api/admin/approved-vendors/${approvedVendorId.value}`, {
      method: 'DELETE'
    })

    await navigateTo('/admin/vendors/approved-vendors')
  } catch (deleteError: unknown) {
    const statusMessage = (deleteError as { statusMessage?: string })
      ?.statusMessage
    formError.value = statusMessage || 'Unable to delete approved vendor.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">
        Edit approved vendor
      </h1>
      <p class="auth-copy">
        Update source mapping values and linked basil ID records.
      </p>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading approved vendor"
      description="Fetching approved vendor details."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load approved vendor"
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
          <span>Basil ID</span>
          <input
            v-model="form.basilId"
            required
            type="text"
          >
        </label>

        <label>
          <span>First name</span>
          <input
            v-model="form.firstName"
            required
            type="text"
          >
        </label>

        <label>
          <span>Last name</span>
          <input
            v-model="form.lastName"
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
          <button
            type="button"
            class="portal-button portal-button--secondary"
            :disabled="isDeleting"
            @click="deleteRecord"
          >
            {{ isDeleting ? "Deleting..." : "Delete record" }}
          </button>
          <NuxtLink
            to="/admin/vendors/approved-vendors"
            class="portal-button portal-button--secondary"
          >
            Back to list
          </NuxtLink>
        </div>
      </form>
    </article>
  </section>
</template>
