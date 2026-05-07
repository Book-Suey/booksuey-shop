<script setup lang="ts">
definePageMeta({
  middleware: "guest-only",
  layout: "default",
});

const auth = useUnifiedAuth();
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const form = reactive({
  email: "",
  password: "",
});

async function submitLogin(): Promise<void> {
  formError.value = null;
  isSubmitting.value = true;

  try {
    const response = await auth.login({
      email: form.email,
      password: form.password,
    });

    if (response.role === "admin") {
      await navigateTo("/admin");
      return;
    }

    await navigateTo("/");
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;
    formError.value = statusMessage || "Unable to sign in as admin.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <article class="auth-card">
      <p class="auth-kicker">Admin access</p>
      <h1 class="auth-title">Sign in to Admin Console</h1>
      <p class="auth-copy">
        Manage vendors, imports, payouts, and operational visibility.
      </p>

      <form class="auth-form" @submit.prevent="submitLogin">
        <label>
          <span>Email</span>
          <input
            v-model="form.email"
            type="email"
            required
            autocomplete="email"
          />
        </label>

        <label>
          <span>Password</span>
          <input
            v-model="form.password"
            type="password"
            required
            autocomplete="current-password"
          />
        </label>

        <p v-if="formError" class="auth-error">
          {{ formError }}
        </p>

        <button
          type="submit"
          class="portal-button portal-button--primary"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? "Signing in..." : "Sign in" }}
        </button>
      </form>
    </article>
  </section>
</template>
