<script setup lang="ts">
definePageMeta({
  middleware: 'guest-only'
})

const isSubmitting = ref(false)
const formError = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const resetLink = ref<string | null>(null)

const form = reactive({
  email: ''
})

async function submitResetRequest(): Promise<void> {
  formError.value = null
  successMessage.value = null
  resetLink.value = null
  isSubmitting.value = true

  try {
    const response = await $fetch<{ message: string, resetToken?: string }>(
      '/api/vendor/reset-password',
      {
        method: 'POST',
        body: {
          email: form.email
        }
      }
    )

    successMessage.value = response.message

    if (response.resetToken) {
      resetLink.value = `/reset-password?token=${response.resetToken}`
    }
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage
    formError.value
      = statusMessage || 'Unable to process reset request right now.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="auth-page">
    <article class="auth-card">
      <p class="auth-kicker">
        Vendor access
      </p>
      <h1 class="auth-title">
        Reset your password
      </h1>
      <p class="auth-copy">
        Enter your account email and we will send a secure password reset link.
      </p>

      <form
        class="auth-form"
        @submit.prevent="submitResetRequest"
      >
        <label>
          <span>Email</span>
          <input
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
            placeholder="name@example.com"
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

        <NuxtLink
          v-if="resetLink"
          :to="resetLink"
          class="auth-inline-link"
        >
          Continue to reset password (development)
        </NuxtLink>

        <button
          class="portal-button portal-button--primary"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? "Sending link..." : "Send reset link" }}
        </button>
      </form>

      <p class="auth-switch">
        Remembered it?
        <NuxtLink to="/login"> Sign in </NuxtLink>
      </p>
    </article>
  </section>
</template>
