<script setup lang="ts">
definePageMeta({
  middleware: "vendor-auth",
  layout: "vendor",
});

interface VendorProfileResponse {
  vendorId: string;
  legalName: string;
  displayName: string;
  email: string;
  phone?: string;
  preferredPayoutMethod?: "paypal" | "venmo";
  payoutRecipientName?: string;
  paypalEmail?: string;
  venmoHandle?: string;
  status: "active" | "inactive";
  approvedVendorId?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

const auth = useVendorAuth();
const hasMounted = ref(false);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const form = reactive({
  legalName: "",
  displayName: "",
  preferredPayoutMethod: "" as "" | "paypal" | "venmo",
  payoutRecipientName: "",
  paypalEmail: "",
  venmoHandle: "",
});

function syncForm(profile: VendorProfileResponse): void {
  form.legalName = profile.legalName || "";
  form.displayName = profile.displayName || "";
  form.preferredPayoutMethod = profile.preferredPayoutMethod || "";
  form.payoutRecipientName = profile.payoutRecipientName || "";
  form.paypalEmail = profile.paypalEmail || "";
  form.venmoHandle = profile.venmoHandle || "";
}

const { data, pending, error, refresh } = await useAsyncData(
  "vendor-profile-page",
  async () => {
    await auth.ensureInitialized();

    const response = await $fetch<{ vendor: VendorProfileResponse }>(
      "/api/vendor/me",
      {
        method: "GET",
        headers: auth.authHeaders(),
      },
    );

    syncForm(response.vendor);
    return response.vendor;
  },
  {
    server: false,
    immediate: false,
    default: () => ({
      vendorId: "",
      legalName: "",
      displayName: "",
      email: "",
      phone: "",
      preferredPayoutMethod: undefined,
      payoutRecipientName: "",
      paypalEmail: "",
      venmoHandle: "",
      status: "active" as const,
      approvedVendorId: undefined,
      lastLoginAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  },
);

onMounted(async () => {
  hasMounted.value = true;
  await refresh();
});

watch(
  () => form.preferredPayoutMethod,
  (method) => {
    if (method !== "paypal") {
      form.paypalEmail = "";
    }

    if (method !== "venmo") {
      form.venmoHandle = "";
    }
  },
);

async function submitProfile(): Promise<void> {
  submitError.value = null;
  successMessage.value = null;
  isSubmitting.value = true;

  try {
    const response = await $fetch<{ vendor: VendorProfileResponse }>(
      "/api/vendor/me",
      {
        method: "PATCH",
        headers: auth.authHeaders(),
        body: {
          legalName: form.legalName.trim(),
          displayName: form.displayName.trim(),
          preferredPayoutMethod: form.preferredPayoutMethod || null,
          payoutRecipientName: form.payoutRecipientName.trim(),
          paypalEmail: form.paypalEmail.trim(),
          venmoHandle: form.venmoHandle.trim(),
        },
      },
    );

    data.value = response.vendor;
    syncForm(response.vendor);
    auth.vendor.value = response.vendor;
    successMessage.value = "Profile updated.";
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage;
    submitError.value =
      statusMessage || "Unable to update your profile right now.";
  } finally {
    isSubmitting.value = false;
  }
}

function formatDate(value?: string): string {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <h1 class="auth-title">Profile and payout settings</h1>
      <p class="auth-copy">
        Update the business name shown in the portal and the payment details we
        will use for PayPal or Venmo payouts.
      </p>
    </header>

    <AppLoadingState
      v-if="hasMounted && pending"
      title="Loading profile"
      description="Fetching your vendor account details."
    />

    <AppErrorState
      v-else-if="hasMounted && error"
      title="Unable to load profile"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Profile data failed to load.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="vendor-summary-grid">
        <article class="admin-card">
          <p class="admin-card__label">Account email</p>
          <p class="admin-card__value admin-card__value--compact">
            {{ data.email }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Linked approved vendor</p>
          <p class="admin-card__value admin-card__value--compact">
            {{ data.approvedVendorId || "Not linked yet" }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Last updated</p>
          <p class="admin-card__value admin-card__value--compact">
            {{ formatDate(data.updatedAt) }}
          </p>
        </article>
      </section>

      <article class="vendor-panel">
        <h2>Profile details</h2>

        <form class="auth-form" @submit.prevent="submitProfile">
          <label>
            <span>Full name</span>
            <input
              v-model="form.displayName"
              type="text"
              required
              autocomplete="name"
            />
          </label>

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
            <span>Preferred payout method</span>
            <select v-model="form.preferredPayoutMethod">
              <option value="">Not set yet</option>
              <option value="paypal">PayPal</option>
              <option value="venmo">Venmo</option>
            </select>
          </label>

          <label>
            <span>Payout recipient name</span>
            <input
              v-model="form.payoutRecipientName"
              type="text"
              :required="Boolean(form.preferredPayoutMethod)"
              placeholder="Name on the payout account"
            />
          </label>

          <label>
            <span>PayPal email</span>
            <input
              v-model="form.paypalEmail"
              type="email"
              :required="form.preferredPayoutMethod === 'paypal'"
              placeholder="payments@example.com"
            />
          </label>

          <label>
            <span>Venmo handle</span>
            <input
              v-model="form.venmoHandle"
              type="text"
              :required="form.preferredPayoutMethod === 'venmo'"
              placeholder="@your-handle"
            />
          </label>

          <p v-if="submitError" class="auth-error">
            {{ submitError }}
          </p>

          <p v-if="successMessage" class="auth-success">
            {{ successMessage }}
          </p>

          <button
            type="submit"
            class="portal-button portal-button--primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "Saving profile..." : "Save profile" }}
          </button>
        </form>
      </article>
    </template>
  </section>
</template>
