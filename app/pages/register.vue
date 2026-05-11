<script setup lang="ts">
definePageMeta({
  middleware: "guest-only",
});

const auth = useVendorAuth();
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const form = reactive({
  legalName: "",
  displayName: "",
  email: "",
  phone: "",
  password: "",
});

async function submitRegistration(): Promise<void> {
  formError.value = null;
  isSubmitting.value = true;

  try {
    await auth.register({
      legalName: form.legalName,
      displayName: form.displayName,
      email: form.email,
      phone: form.phone || undefined,
      password: form.password,
    });

    await navigateTo("/auth-success?event=registered");
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;
    formError.value = statusMessage || "Unable to create account right now.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <article class="auth-card">
      <h1 class="auth-title">Register your vendor account</h1>
      <p class="auth-copy">
        Use the same email from your approved vendor record to link historical
        sales automatically.
      </p>

      <form class="auth-form" @submit.prevent="submitRegistration">
        <label>
          <span>Legal name</span>
          <input
            v-model="form.legalName"
            type="text"
            required
            autocomplete="organization"
          />
        </label>

        <label>
          <span>Display name</span>
          <input v-model="form.displayName" type="text" required />
        </label>

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
          <span>Phone (optional)</span>
          <input v-model="form.phone" type="tel" autocomplete="tel" />
        </label>

        <label>
          <span>Password</span>
          <input
            v-model="form.password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
          />
        </label>

        <p v-if="formError" class="auth-error">
          {{ formError }}
        </p>

        <button
          class="portal-button portal-button--primary"
          type="submit"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? "Creating account..." : "Create account" }}
        </button>
      </form>

      <p class="auth-switch">
        Already have an account?
        <NuxtLink to="/login"> Sign in </NuxtLink>
      </p>
    </article>
  </section>
</template>
