<script setup lang="ts">
definePageMeta({
  middleware: "guest-only",
});

const route = useRoute();
const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const form = reactive({
  password: "",
  confirmPassword: "",
});

const token = computed(() => {
  const tokenQuery = route.query.token;

  if (typeof tokenQuery === "string") {
    return tokenQuery;
  }

  return "";
});

const {
  data: verification,
  pending: isVerifying,
  error: verifyError,
  refresh: refreshVerification,
} = await useAsyncData(
  "unified-reset-token-verification",
  async () => {
    if (!token.value) {
      throw createError({
        statusCode: 400,
        statusMessage: "Missing reset token.",
      });
    }

    return await $fetch<{ valid: boolean; email: string }>(
      "/api/auth/verify-reset-token",
      {
        method: "GET",
        query: {
          token: token.value,
        },
      },
    );
  },
  {
    server: false,
    watch: [token],
    default: () => null,
  },
);

async function submitPasswordUpdate(): Promise<void> {
  formError.value = null;

  if (!token.value) {
    formError.value = "Missing reset token.";
    return;
  }

  if (form.password.length < 8) {
    formError.value = "Password must be at least 8 characters.";
    return;
  }

  if (form.password !== form.confirmPassword) {
    formError.value = "Passwords do not match.";
    return;
  }

  isSubmitting.value = true;

  try {
    await $fetch<{ message: string }>("/api/auth/update-password", {
      method: "POST",
      body: {
        token: token.value,
        password: form.password,
      },
    });

    await navigateTo("/auth-success?event=reset-password");
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;
    formError.value = statusMessage || "Unable to update password right now.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="auth-page">
    <article class="auth-card">
      <p class="auth-kicker">Account access</p>
      <h1 class="auth-title">Set a new password</h1>
      <p class="auth-copy">Choose a strong password for your account.</p>

      <AppLoadingState
        v-if="isVerifying"
        title="Verifying token"
        description="Please wait while we validate your reset link."
      />

      <AppErrorState
        v-else-if="verifyError"
        title="Reset link is invalid"
        :message="
          (verifyError as { statusMessage?: string })?.statusMessage ||
          'The reset token is invalid or expired.'
        "
        retry-label="Verify again"
        @retry="refreshVerification"
      >
        <NuxtLink to="/forgot-password" class="auth-inline-link">
          Request a new reset link
        </NuxtLink>
      </AppErrorState>

      <form
        v-else-if="verification?.valid"
        class="auth-form"
        @submit.prevent="submitPasswordUpdate"
      >
        <p class="auth-copy auth-copy--compact">
          Resetting password for {{ verification.email }}
        </p>

        <label>
          <span>New password</span>
          <input
            v-model="form.password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            placeholder="At least 8 characters"
          />
        </label>

        <label>
          <span>Confirm password</span>
          <input
            v-model="form.confirmPassword"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            placeholder="Re-enter new password"
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
          {{ isSubmitting ? "Updating password..." : "Update password" }}
        </button>
      </form>
    </article>
  </section>
</template>
