<script setup lang="ts">
definePageMeta({
  middleware: 'guest-only'
})

const auth = useUnifiedAuth()
const isSubmitting = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  email: '',
  password: ''
})

async function submitLogin(): Promise<void> {
  formError.value = null
  isSubmitting.value = true

  try {
    const response = await auth.login({
      email: form.email,
      password: form.password
    })

    if (response.role === 'admin') {
      await navigateTo('/admin')
      return
    }

    await navigateTo('/vendor')
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage
    formError.value
      = statusMessage || 'Unable to sign in with those credentials.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="auth-page">
    <article class="auth-card">
      <h1 class="auth-title">
        Sign in to Book Suey
      </h1>
      <p class="auth-copy">
        Access your sales history, ledger activity, and payout requests.
      </p>

      <form
        class="auth-form"
        @submit.prevent="submitLogin"
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

        <label>
          <span>Password</span>
          <input
            v-model="form.password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
          >
        </label>

        <NuxtLink
          to="/forgot-password"
          class="auth-inline-link"
        >
          Forgot password?
        </NuxtLink>

        <p
          v-if="formError"
          class="auth-error"
        >
          {{ formError }}
        </p>

        <button
          class="portal-button portal-button--primary"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? "Signing in..." : "Sign in" }}
        </button>
      </form>

      <p class="auth-switch">
        New to Book Suey?
        <NuxtLink to="/register"> Create your vendor account </NuxtLink>
      </p>
    </article>
  </section>
</template>
