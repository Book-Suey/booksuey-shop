<script setup lang="ts">
definePageMeta({
  middleware: "vendor-auth",
  layout: "vendor",
});

interface VendorBalance {
  pendingAmount: string;
  availableAmount: string;
  paidAmount: string;
  asOf: string;
}

interface VendorPayoutRequest {
  payoutRequestId: string;
  amount: string;
  currency: string;
  status: string;
  reviewNote?: string;
  rejectionReason?: string;
  requestedAt: string;
}

const auth = useVendorAuth();
const hasMounted = ref(false);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const form = reactive({
  amount: "" as string | number,
});

const columns = [
  { key: "expand", label: "" },
  { key: "requestedAt", label: "Requested At" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];

function getPayoutDecisionNote(
  request: VendorPayoutRequest,
): { label: string; message: string } | null {
  if (request.rejectionReason?.trim()) {
    return {
      label: "Rejection reason",
      message: request.rejectionReason,
    };
  }

  if (request.reviewNote?.trim()) {
    return {
      label: "Approval note",
      message: request.reviewNote,
    };
  }

  return null;
}

function hasPayoutDecisionNote(request: VendorPayoutRequest): boolean {
  return getPayoutDecisionNote(request) !== null;
}

function toggleExpandedRow(tableRow: {
  getCanExpand: () => boolean;
  toggleExpanded: () => void;
}): void {
  if (!tableRow.getCanExpand()) {
    return;
  }

  tableRow.toggleExpanded();
}

function formatCurrency(amount: string, currency = "USD"): string {
  const parsed = Number.parseFloat(amount);

  if (Number.isNaN(parsed)) {
    return amount;
  }

  return parsed.toLocaleString("en-US", {
    style: "currency",
    currency,
  });
}

function formatDate(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const { data, pending, error, refresh } = await useAsyncData(
  "vendor-payouts-page",
  async () => {
    await auth.ensureInitialized();
    const headers = auth.authHeaders();

    const [balanceResponse, requestsResponse] = await Promise.all([
      $fetch<{ balance: VendorBalance }>("/api/vendor/balance", {
        method: "GET",
        headers,
      }),
      $fetch<{ payoutRequests: VendorPayoutRequest[] }>(
        "/api/vendor/payout-requests",
        {
          method: "GET",
          headers,
        },
      ),
    ]);

    return {
      balance: balanceResponse.balance,
      payoutRequests: requestsResponse.payoutRequests,
    };
  },
  {
    server: false,
    immediate: false,
    default: () => ({
      balance: {
        pendingAmount: "0",
        availableAmount: "0",
        paidAmount: "0",
        asOf: new Date().toISOString(),
      },
      payoutRequests: [] as VendorPayoutRequest[],
    }),
  },
);

onMounted(async () => {
  hasMounted.value = true;
  await refresh();
});

async function submitPayoutRequest(): Promise<void> {
  submitError.value = null;
  successMessage.value = null;

  const normalizedAmount = String(form.amount ?? "").trim();
  if (!normalizedAmount) {
    submitError.value = "Enter an amount to request.";
    return;
  }

  isSubmitting.value = true;

  try {
    const response = await $fetch<{
      payoutRequest: VendorPayoutRequest;
      balance: VendorBalance;
    }>("/api/vendor/payout-requests", {
      method: "POST",
      headers: auth.authHeaders(),
      body: {
        amount: normalizedAmount,
      },
    });

    data.value.payoutRequests.unshift(response.payoutRequest);
    data.value.balance = response.balance;
    form.amount = "";
    successMessage.value = "Payout request submitted.";
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage;
    submitError.value =
      statusMessage || "Unable to submit payout request right now.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <h1 class="auth-title">Request a payout</h1>
      <p class="auth-copy">
        Submit requests against available funds and track payout status history.
      </p>
    </header>

    <AppLoadingState
      v-if="hasMounted && pending"
      title="Loading payouts"
      description="Fetching payout history and current available balance."
    />

    <AppErrorState
      v-else-if="hasMounted && error"
      title="Unable to load payouts"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Payout request data failed to load.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="vendor-summary-grid">
        <article class="admin-card">
          <p class="admin-card__label">Available to request</p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.availableAmount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Pending</p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.pendingAmount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Paid</p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.paidAmount) }}
          </p>
        </article>
      </section>

      <article class="vendor-panel">
        <h2>New request</h2>
        <form class="auth-form" @submit.prevent="submitPayoutRequest">
          <label>
            <span>Amount (USD)</span>
            <input
              v-model="form.amount"
              type="number"
              min="0.01"
              step="0.01"
              inputmode="decimal"
              placeholder="0.00"
              required
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
            {{
              isSubmitting ? "Submitting request..." : "Submit payout request"
            }}
          </button>
        </form>
      </article>

      <article class="vendor-panel">
        <h2>Payout history</h2>

        <AppEmptyState
          v-if="data.payoutRequests.length === 0"
          title="No payout requests"
          description="Your payout request history will show up after your first request."
        />

        <AppDataTable
          v-else
          :columns="columns"
          :rows="data.payoutRequests"
          :row-key="(row) => row.payoutRequestId"
          :mobile-columns="['status', 'amount', 'requestedAt', 'expand']"
          :row-expandable="
            (row) => hasPayoutDecisionNote(row as VendorPayoutRequest)
          "
        >
          <template #cell:expand="{ row, tableRow }">
            <button
              v-if="hasPayoutDecisionNote(row as VendorPayoutRequest)"
              type="button"
              class="portal-button portal-button--secondary vendor-payouts__expand-button"
              @click="
                toggleExpandedRow(
                  tableRow as {
                    getCanExpand: () => boolean;
                    toggleExpanded: () => void;
                  },
                )
              "
            >
              {{
                (tableRow as { getIsExpanded: () => boolean }).getIsExpanded()
                  ? "Hide note"
                  : "Show note"
              }}
            </button>
            <span v-else class="vendor-payouts__no-note">-</span>
          </template>

          <template #cell:requestedAt="{ row }">
            {{ formatDate(row.requestedAt as string) }}
          </template>

          <template #cell:amount="{ row }">
            {{ formatCurrency(row.amount as string, row.currency as string) }}
          </template>

          <template #cell:status="{ row }">
            <AppStatusBadge :status="row.status as string" />
          </template>

          <template #expanded="{ row }">
            <div
              v-if="getPayoutDecisionNote(row as VendorPayoutRequest)"
              class="vendor-payouts__expanded-note"
            >
              <p class="vendor-payouts__expanded-label">
                {{ getPayoutDecisionNote(row as VendorPayoutRequest)?.label }}
              </p>
              <p class="vendor-payouts__expanded-copy">
                {{ getPayoutDecisionNote(row as VendorPayoutRequest)?.message }}
              </p>
            </div>
          </template>
        </AppDataTable>
      </article>
    </template>
  </section>
</template>

<style scoped>
.vendor-payouts__expand-button {
  min-width: 7rem;
}

.vendor-payouts__no-note {
  color: rgb(100 116 139);
}

.vendor-payouts__expanded-note {
  border-left: 3px solid rgb(125 211 252);
  padding: 0.75rem 1rem;
  margin: 0.25rem 0;
  background: rgb(248 250 252);
}

.vendor-payouts__expanded-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(15 23 42);
  margin: 0 0 0.25rem;
}

.vendor-payouts__expanded-copy {
  margin: 0;
  color: rgb(30 41 59);
  white-space: pre-wrap;
}
</style>
