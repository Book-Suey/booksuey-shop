<script setup lang="ts">
definePageMeta({
  middleware: "admin-auth",
  layout: "admin",
});

interface PayoutRequestDetail {
  payoutRequestId: string;
  vendorId: string;
  vendorName: string;
  amount: string;
  currency: string;
  status:
    | "requested"
    | "approved"
    | "disbursing"
    | "paid"
    | "failed"
    | "rejected";
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewNote?: string;
  disbursingAt?: string;
  paidAt?: string;
  failedAt?: string;
}

const auth = useAdminAuth();
const route = useRoute();
const router = useRouter();

const isApproving = ref(false);
const isRejecting = ref(false);
const formError = ref<string | null>(null);
const approvalForm = reactive({
  reviewNote: "",
});

const rejectionForm = reactive({
  reason: "",
});

function formatDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-payout-detail-${route.params.payoutId as string}`,
  async () => {
    await auth.ensureInitialized();

    return await $fetch<{ payoutRequest: PayoutRequestDetail }>(
      `/api/admin/payout-requests/${route.params.payoutId as string}`,
      {
        method: "GET",
        headers: auth.authHeaders(),
      },
    );
  },
  {
    server: false,
    default: () => ({
      payoutRequest: {
        payoutRequestId: "",
        vendorId: "",
        vendorName: "",
        amount: "0",
        currency: "USD",
        status: "requested" as const,
        requestedAt: new Date().toISOString(),
        approvedAt: undefined,
        rejectedAt: undefined,
        rejectionReason: undefined,
        reviewedBy: undefined,
        reviewNote: undefined,
        disbursingAt: undefined,
        paidAt: undefined,
        failedAt: undefined,
      },
    }),
  },
);

async function handleApprove(): Promise<void> {
  formError.value = null;
  isApproving.value = true;

  try {
    await auth.ensureInitialized();

    await $fetch<{ payoutRequest: PayoutRequestDetail }>(
      `/api/admin/payout-requests/${route.params.payoutId as string}/approve`,
      {
        method: "POST",
        headers: auth.authHeaders(),
        body: {
          reviewNote: approvalForm.reviewNote.trim(),
        },
      },
    );

    approvalForm.reviewNote = "";
    await refresh();
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;
    formError.value =
      statusMessage || "Unable to approve this payout request right now.";
  } finally {
    isApproving.value = false;
  }
}

async function handleReject(): Promise<void> {
  formError.value = null;

  if (!rejectionForm.reason.trim()) {
    formError.value = "Enter a reason for rejecting this payout request.";
    return;
  }

  isRejecting.value = true;

  try {
    await auth.ensureInitialized();

    await $fetch<{ payoutRequest: PayoutRequestDetail }>(
      `/api/admin/payout-requests/${route.params.payoutId as string}/reject`,
      {
        method: "POST",
        headers: auth.authHeaders(),
        body: {
          reason: rejectionForm.reason.trim(),
        },
      },
    );

    rejectionForm.reason = "";
    await refresh();
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;
    formError.value =
      statusMessage || "Unable to reject this payout request right now.";
  } finally {
    isRejecting.value = false;
  }
}

async function handleDisbursement(): Promise<void> {
  await router.push(
    `/admin/disbursements/new?payoutRequestId=${route.params.payoutId as string}`,
  );
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">Admin payout operations</p>
      <h1 class="auth-title">Request {{ route.params.payoutId }}</h1>
      <p class="auth-copy">
        Review payout request details and approve, reject, or disburse the
        payment.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/payout-requests"
          class="portal-button portal-button--secondary"
        >
          Back to queue
        </NuxtLink>
        <NuxtLink
          :to="`/admin/audit?entityType=PayoutRequest&entityId=${route.params.payoutId as string}`"
          class="portal-button portal-button--secondary"
        >
          View request audit events
        </NuxtLink>
        <NuxtLink
          v-if="data.payoutRequest.status === 'failed'"
          to="/admin/payout-requests/payout-failures"
          class="portal-button portal-button--secondary"
        >
          Open failure board
        </NuxtLink>
      </div>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading payout request"
      description="Fetching request details and history."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load payout request"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Payout detail request failed.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="admin-cards">
        <article class="admin-card">
          <p class="admin-card__label">Vendor</p>
          <p class="admin-card__value">
            {{ data.payoutRequest.vendorName }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Amount</p>
          <p class="admin-card__value">
            {{ formatCurrency(data.payoutRequest.amount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Status</p>
          <p class="admin-card__value">
            <AppStatusBadge :status="data.payoutRequest.status" />
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Requested at</p>
          <p class="admin-card__value">
            {{ formatDate(data.payoutRequest.requestedAt) }}
          </p>
        </article>

        <article v-if="data.payoutRequest.approvedAt" class="admin-card">
          <p class="admin-card__label">Approved at</p>
          <p class="admin-card__value">
            {{ formatDate(data.payoutRequest.approvedAt) }}
          </p>
        </article>

        <article v-if="data.payoutRequest.reviewNote" class="admin-card">
          <p class="admin-card__label">Review note</p>
          <p class="admin-card__value">
            {{ data.payoutRequest.reviewNote }}
          </p>
        </article>

        <article v-if="data.payoutRequest.rejectedAt" class="admin-card">
          <p class="admin-card__label">Rejected at</p>
          <p class="admin-card__value">
            {{ formatDate(data.payoutRequest.rejectedAt) }}
          </p>
        </article>

        <article v-if="data.payoutRequest.rejectionReason" class="admin-card">
          <p class="admin-card__label">Rejection reason</p>
          <p class="admin-card__value">
            {{ data.payoutRequest.rejectionReason }}
          </p>
        </article>

        <article v-if="data.payoutRequest.disbursingAt" class="admin-card">
          <p class="admin-card__label">Disbursing at</p>
          <p class="admin-card__value">
            {{ formatDate(data.payoutRequest.disbursingAt) }}
          </p>
        </article>

        <article v-if="data.payoutRequest.paidAt" class="admin-card">
          <p class="admin-card__label">Paid at</p>
          <p class="admin-card__value">
            {{ formatDate(data.payoutRequest.paidAt) }}
          </p>
        </article>
      </section>

      <template v-if="data.payoutRequest.status === 'requested'">
        <article class="vendor-panel stack-grid">
          <div>
            <h2>Approve payout request</h2>
            <p class="panel-copy">
              Approve this payout request to move it to the approved queue for
              disbursement. Any note you add here is visible to the vendor.
            </p>
          </div>

          <form class="auth-form" @submit.prevent="handleApprove">
            <label>
              <span>Review note (optional, visible to vendor)</span>
              <textarea
                v-model="approvalForm.reviewNote"
                placeholder="Add any notes about this approval decision..."
                rows="3"
              />
            </label>

            <p v-if="formError" class="auth-error">
              {{ formError }}
            </p>

            <button
              type="submit"
              class="portal-button portal-button--primary"
              :disabled="isApproving"
            >
              {{ isApproving ? "Approving..." : "Approve request" }}
            </button>
          </form>
        </article>

        <article class="vendor-panel stack-grid">
          <div>
            <h2>Reject payout request</h2>
            <p class="panel-copy">
              Reject this payout request and explain the reason. This message is
              visible to the vendor.
            </p>
          </div>

          <form class="auth-form" @submit.prevent="handleReject">
            <label>
              <span>Rejection reason (visible to vendor)</span>
              <textarea
                v-model="rejectionForm.reason"
                placeholder="Explain why this payout is being rejected..."
                rows="3"
                required
              />
            </label>

            <p v-if="formError" class="auth-error">
              {{ formError }}
            </p>

            <button
              type="submit"
              class="portal-button portal-button--secondary"
              :disabled="isRejecting"
            >
              {{ isRejecting ? "Rejecting..." : "Reject request" }}
            </button>
          </form>
        </article>
      </template>

      <template v-else-if="data.payoutRequest.status === 'approved'">
        <article class="vendor-panel stack-grid">
          <div>
            <h2>Execute disbursement</h2>
            <p class="panel-copy">
              This payout request has been approved and is ready for
              disbursement. Click below to specify the payment method and
              provider reference.
            </p>
          </div>

          <button
            type="button"
            class="portal-button portal-button--primary"
            @click="handleDisbursement"
          >
            Create disbursement
          </button>
        </article>
      </template>

      <template v-else>
        <article class="vendor-panel">
          <div>
            <h2>Payout action completed</h2>
            <p class="panel-copy">
              This payout request has already been processed. Its current status
              is <strong>{{ data.payoutRequest.status }}</strong
              >.
            </p>
          </div>
        </article>
      </template>
    </template>
  </section>
</template>
