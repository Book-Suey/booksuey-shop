<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

const isSubmitting = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  basilId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
})

async function submitNewApprovedVendor(): Promise<void> {
  formError.value = null
  isSubmitting.value = true

  try {
    const response = await $fetch<{ approvedVendor: { basilId: string } }>(
      '/api/admin/approved-vendors',
      {
        method: 'POST',
        body: {
          basilId: form.basilId,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined
        }
      }
    )

    await navigateTo(
      `/admin/approved-vendors/${response.approvedVendor.basilId}`
    )
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage
    formError.value
      = statusMessage || 'Unable to create approved vendor record.'
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
        Add approved vendor
      </h1>
      <p class="auth-copy">
        Create an approved vendor source mapping record.
      </p>
    </header>

    <article class="vendor-panel">
      <form
        class="auth-form"
        @submit.prevent="submitNewApprovedVendor"
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

        <div class="vendor-actions">
          <button
            type="submit"
            class="portal-button portal-button--primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "Creating..." : "Create approved vendor" }}
          </button>
          <NuxtLink
            to="/admin/approved-vendors"
            class="portal-button portal-button--secondary"
          >
            Cancel
          </NuxtLink>
        </div>
      </form>
    </article>
  </section>
</template>
