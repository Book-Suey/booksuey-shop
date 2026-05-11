<script setup lang="ts">
definePageMeta({
  middleware: "admin-auth",
  layout: "admin",
});

interface DisbursementResponse {
  idempotentReplay?: boolean;
  alreadyInProgress?: boolean;
  disbursement: {
    disbursementId: string;
    payoutRequestId: string;
    methodType: string;
    providerReferenceId: string;
    amount: string;
    currency: string;
    status: string;
    disbursedAt: string;
  };
}

interface PayoutRequestDetailsResponse {
  payoutRequest: {
    payoutRequestId: string;
    vendorId: string;
    vendorName: string;
    amount: string;
    currency: string;
    status: string;
    requestedAt: string;
    approvedAt?: string;
    rejectedAt?: string;
    rejectionReason?: string;
    reviewedBy?: string;
    reviewNote?: string;
    disbursingAt?: string;
    paidAt?: string;
    failedAt?: string;
    createdAt: string;
    updatedAt: string;
  };
  vendor: {
    preferredPayoutMethod?: "paypal" | "venmo";
    paypalEmail?: string;
    venmoHandle?: string;
  } | null;
}

const route = useRoute();
const router = useRouter();
const auth = useAdminAuth();

const hasMounted = ref(false);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const payoutRequestId = computed(() => route.query.payoutRequestId as string);

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-disbursement-request-${payoutRequestId.value || "missing"}`,
  async () => {
    if (!payoutRequestId.value) {
      return null;
    }

    await auth.ensureInitialized();

    return await $fetch<PayoutRequestDetailsResponse>(
      `/api/admin/payout-requests/${payoutRequestId.value}`,
      {
        method: "GET",
        headers: auth.authHeaders(),
      },
    );
  },
  {
    server: false,
    immediate: false,
    default: () => null,
  },
);

const selectedMethod = computed(
  () => data.value?.vendor?.preferredPayoutMethod || null,
);
const selectedMethodLabel = computed(() => {
  if (selectedMethod.value === "venmo") {
    return "Venmo";
  }

  if (selectedMethod.value === "paypal") {
    return "PayPal";
  }

  return "Not configured";
});

const selectedMethodDescription = computed(() => {
  if (selectedMethod.value === "venmo") {
    return data.value?.vendor?.venmoHandle || "Vendor Venmo handle";
  }

  if (selectedMethod.value === "paypal") {
    return data.value?.vendor?.paypalEmail || "Vendor PayPal email";
  }

  return "The vendor does not have a preferred payout method configured.";
});

if (!payoutRequestId.value) {
  onBeforeMount(() => {
    submitError.value =
      "No payout request specified. Please navigate from a payout detail page.";
  });
}

onMounted(async () => {
  hasMounted.value = true;
  await refresh();
});

async function submitDisbursement(): Promise<void> {
  submitError.value = null;
  successMessage.value = null;

  if (!selectedMethod.value) {
    submitError.value = "The vendor has no configured preferred payout method.";
    return;
  }

  isSubmitting.value = true;

  try {
    await auth.ensureInitialized();

    // Generate a simple idempotency key from timestamp and random string
    const idempotencyKey = `disbursement_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const result = await $fetch<DisbursementResponse>(
      "/api/admin/disbursements",
      {
        method: "POST",
        headers: auth.authHeaders(),
        body: {
          payoutRequestId: payoutRequestId.value,
          methodType: selectedMethod.value,
          idempotencyKey,
        },
      },
    );

    if (result.alreadyInProgress) {
      successMessage.value = `Disbursement ${result.disbursement.disbursementId} is already in progress. Awaiting PayPal confirmation.`;
    } else {
      successMessage.value = `Disbursement ${result.disbursement.disbursementId} initiated. Awaiting PayPal confirmation.`;
    }

    setTimeout(() => {
      router.push(`/admin/payout-requests/${payoutRequestId.value}`);
    }, 1000);
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;

    if (statusMessage?.includes("PAYOUT_INVALID_STATE_TRANSITION")) {
      submitError.value =
        "This payout request is no longer in approved status. Refresh the request page to see the latest status.";
    } else {
      submitError.value =
        statusMessage || "Unable to create disbursement right now.";
    }
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">Create disbursement</h1>
      <p class="auth-copy">
        Execute a payment disbursement for an approved payout request using the
        vendor's preferred payout method.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          v-if="payoutRequestId"
          :to="`/admin/payout-requests/${payoutRequestId}`"
          class="portal-button portal-button--secondary"
        >
          Back to request
        </NuxtLink>
        <NuxtLink
          to="/admin/payout-requests"
          class="portal-button portal-button--secondary"
        >
          Back to queue
        </NuxtLink>
      </div>
    </header>

    <AppLoadingState
      v-if="hasMounted && pending"
      title="Loading disbursement details"
      description="Fetching the vendor payout preference for this request."
    />

    <AppErrorState
      v-else-if="hasMounted && error"
      title="Unable to load disbursement details"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Disbursement request data failed to load.'
      "
      @retry="refresh"
    />

    <article v-else class="vendor-panel stack-grid">
      <div>
        <h2>Disbursement details</h2>
        <p class="panel-copy">
          The vendor is configured for {{ selectedMethodLabel }} payouts. The
          provider reference is generated automatically.
        </p>
      </div>

      <div class="admin-card">
        <p class="admin-card__label">Payment method</p>
        <p class="admin-card__value admin-card__value--compact">
          {{ selectedMethodLabel }}
        </p>
        <p class="panel-copy auth-copy--compact">
          {{ selectedMethodDescription }}
        </p>
      </div>

      <p v-if="submitError" class="auth-error">
        {{ submitError }}
      </p>

      <p v-if="successMessage" class="auth-success">
        {{ successMessage }}
      </p>

      <button
        type="button"
        class="portal-button portal-button--primary"
        :disabled="isSubmitting || !selectedMethod"
        @click="submitDisbursement"
      >
        {{ isSubmitting ? "Creating disbursement..." : "Create disbursement" }}
      </button>
    </article>
  </section>
</template>
