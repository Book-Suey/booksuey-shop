<script setup lang="ts">
definePageMeta({
  middleware: "admin-auth",
  layout: "admin",
});

interface PayoutFailure {
  payoutRequestId: string;
  vendorId: string;
  amount: string;
  currency: "USD";
  status: "failed";
  failedAt?: string;
  disbursement?: {
    disbursementId: string;
    methodType: "paypal" | "venmo";
    providerReferenceId: string;
    status: "disbursing" | "paid" | "failed";
    disbursedAt: string;
    failureReason?: string;
  };
  reconciliation: {
    expectedReleaseAmount: string;
    releasedAmount: string;
    restored: boolean;
  };
  balanceSnapshot?: {
    pendingAmount: string;
    availableAmount: string;
    paidAmount: string;
    asOf: string;
  };
}

const auth = useAdminAuth();
const recheckingPayoutId = ref<string | null>(null);
const recheckMessage = ref<string | null>(null);
const recheckError = ref<string | null>(null);
const lastRecheckAtByPayoutId = ref<Record<string, string>>({});

const filters = reactive({
  vendorId: "",
  dateFrom: "",
  dateTo: "",
});

const columns = [
  { key: "payoutRequestId", label: "Payout Request" },
  { key: "vendorId", label: "Vendor" },
  { key: "amount", label: "Amount" },
  { key: "failedAt", label: "Failed At" },
  { key: "failureReason", label: "Failure Reason" },
  { key: "reconciliation", label: "Reconciliation" },
  { key: "actions", label: "Actions" },
];

function toIsoBoundary(
  value: string,
  boundary: "start" | "end",
): string | undefined {
  if (!value) {
    return undefined;
  }

  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return new Date(`${value}${suffix}`).toISOString();
}

function formatDate(value?: string): string {
  if (!value) {
    return "n/a";
  }

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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.parseFloat(amount));
}

function toCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

const { data, pending, error, refresh } = await useAsyncData(
  "admin-payout-failures",
  async () => {
    await auth.ensureInitialized();

    const query: Record<string, string | number> = {
      limit: 100,
    };

    if (filters.vendorId.trim()) {
      query.vendorId = filters.vendorId.trim();
    }

    const dateFrom = toIsoBoundary(filters.dateFrom, "start");
    const dateTo = toIsoBoundary(filters.dateTo, "end");

    if (dateFrom) {
      query.dateFrom = dateFrom;
    }

    if (dateTo) {
      query.dateTo = dateTo;
    }

    return await $fetch<{ payoutFailures: PayoutFailure[] }>(
      "/api/admin/payout-failures",
      {
        method: "GET",
        headers: auth.authHeaders(),
        query,
      },
    );
  },
  {
    server: false,
    watch: [
      () => filters.vendorId,
      () => filters.dateFrom,
      () => filters.dateTo,
    ],
    default: () => ({ payoutFailures: [] as PayoutFailure[] }),
  },
);

const metrics = computed(() => {
  const failures = data.value.payoutFailures;

  return {
    total: failures.length,
    restored: failures.filter((failure) => failure.reconciliation.restored)
      .length,
    pendingRestore: failures.filter(
      (failure) => !failure.reconciliation.restored,
    ).length,
    withDisbursementError: failures.filter((failure) =>
      Boolean(failure.disbursement?.failureReason),
    ).length,
  };
});

const csvContent = computed(() => {
  const header = [
    "payoutRequestId",
    "vendorId",
    "amount",
    "failedAt",
    "methodType",
    "providerReferenceId",
    "failureReason",
    "expectedReleaseAmount",
    "releasedAmount",
    "restored",
    "availableAmount",
    "paidAmount",
  ];

  const rows = data.value.payoutFailures.map((failure) => [
    failure.payoutRequestId,
    failure.vendorId,
    failure.amount,
    failure.failedAt ?? "",
    failure.disbursement?.methodType ?? "",
    failure.disbursement?.providerReferenceId ?? "",
    failure.disbursement?.failureReason ?? "",
    failure.reconciliation.expectedReleaseAmount,
    failure.reconciliation.releasedAmount,
    failure.reconciliation.restored ? "true" : "false",
    failure.balanceSnapshot?.availableAmount ?? "",
    failure.balanceSnapshot?.paidAmount ?? "",
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => toCsvCell(String(cell))).join(","))
    .join("\n");
});

const csvHref = computed(() => {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent.value)}`;
});

const csvFileName = computed(() => {
  const dateStamp = new Date().toISOString().slice(0, 10);
  return `payout-failures-${dateStamp}.csv`;
});

async function recheckPayoutProviderStatus(
  payoutRequestId: string,
): Promise<void> {
  recheckMessage.value = null;
  recheckError.value = null;
  recheckingPayoutId.value = payoutRequestId;

  try {
    await auth.ensureInitialized();

    const result = await $fetch<{
      reconciledCount: number;
      updatedCount: number;
    }>("/api/admin/payout-recovery", {
      method: "POST",
      headers: auth.authHeaders(),
      body: {
        action: "reconcile",
        payoutRequestId,
        limit: 10,
      },
    });

    if (result.reconciledCount === 0) {
      recheckMessage.value =
        "No disbursing disbursement found for this payout request.";
    } else {
      recheckMessage.value = `Provider recheck complete for ${payoutRequestId} (${result.updatedCount} updates applied).`;
    }

    lastRecheckAtByPayoutId.value = {
      ...lastRecheckAtByPayoutId.value,
      [payoutRequestId]: new Date().toISOString(),
    };

    await refresh();
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;
    recheckError.value =
      statusMessage || "Unable to recheck provider status right now.";
  } finally {
    recheckingPayoutId.value = null;
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">Admin operational visibility</p>
      <h1 class="auth-title">Payout failures</h1>
      <p class="auth-copy">
        Reconcile failed payout attempts, verify released funds restoration, and
        export current failure state for finance follow-up.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/audit?entityType=PayoutRequest"
          class="portal-button portal-button--secondary"
        >
          View payout audit events
        </NuxtLink>
        <a
          :href="csvHref"
          :download="csvFileName"
          class="portal-button portal-button--primary"
        >
          Export CSV
        </a>
      </div>
    </header>

    <section class="admin-cards">
      <article class="admin-card">
        <p class="admin-card__label">Failures in view</p>
        <p class="admin-card__value">
          {{ metrics.total }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">Restored balances</p>
        <p class="admin-card__value">
          {{ metrics.restored }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">Pending restoration</p>
        <p class="admin-card__value">
          {{ metrics.pendingRestore }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">Provider failures</p>
        <p class="admin-card__value">
          {{ metrics.withDisbursementError }}
        </p>
      </article>
    </section>

    <article class="vendor-panel">
      <h2>Filters</h2>

      <form class="auth-form filter-grid">
        <label>
          <span>Vendor ID</span>
          <input
            v-model="filters.vendorId"
            type="text"
            placeholder="vendor_123"
          />
        </label>

        <label>
          <span>Failed from</span>
          <input v-model="filters.dateFrom" type="date" />
        </label>

        <label>
          <span>Failed to</span>
          <input v-model="filters.dateTo" type="date" />
        </label>
      </form>
    </article>

    <AppLoadingState
      v-if="pending"
      title="Loading payout failures"
      description="Fetching failed payout requests and reconciliation details."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load payout failures"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Payout failure request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="data.payoutFailures.length === 0"
      title="No payout failures found"
      description="Adjust filters or date range to inspect a broader period."
    />

    <article v-else class="vendor-panel">
      <h2>Failed payouts</h2>

      <p v-if="recheckMessage" class="auth-success">
        {{ recheckMessage }}
      </p>
      <p v-if="recheckError" class="auth-error">
        {{ recheckError }}
      </p>

      <AppDataTable
        :columns="columns"
        :rows="data.payoutFailures"
        :row-key="(row) => row.payoutRequestId"
        :mobile-columns="[
          'payoutRequestId',
          'vendorId',
          'failedAt',
          'amount',
          'failureReason',
          'reconciliation',
          'actions',
        ]"
      >
        <template #cell:amount="{ row }">
          {{ formatCurrency(row.amount as string) }}
        </template>

        <template #cell:failedAt="{ row }">
          {{ formatDate(row.failedAt as string | undefined) }}
        </template>

        <template #cell:failureReason="{ row }">
          {{
            (row.disbursement as PayoutFailure["disbursement"])
              ?.failureReason || "n/a"
          }}
        </template>

        <template #cell:reconciliation="{ row }">
          <p>
            {{
              formatCurrency(row.reconciliation.expectedReleaseAmount as string)
            }}
            expected /
            {{ formatCurrency(row.reconciliation.releasedAmount as string) }}
            released
          </p>
          <AppStatusBadge
            :status="
              (row.reconciliation.restored as boolean) ? 'completed' : 'failed'
            "
          />
        </template>

        <template #cell:actions="{ row }">
          <div class="vendor-actions">
            <NuxtLink
              :to="`/admin/payout-requests/${row.payoutRequestId as string}`"
            >
              Open request
            </NuxtLink>

            <button
              type="button"
              class="portal-button portal-button--secondary"
              :disabled="
                recheckingPayoutId === (row.payoutRequestId as string) ||
                (row.disbursement as PayoutFailure['disbursement'])?.status !==
                  'disbursing'
              "
              @click="
                recheckPayoutProviderStatus(row.payoutRequestId as string)
              "
            >
              {{
                recheckingPayoutId === (row.payoutRequestId as string)
                  ? "Rechecking..."
                  : "Recheck provider"
              }}
            </button>

            <p
              v-if="lastRecheckAtByPayoutId[row.payoutRequestId as string]"
              class="panel-copy"
            >
              Last recheck:
              {{
                formatDate(
                  lastRecheckAtByPayoutId[row.payoutRequestId as string],
                )
              }}
            </p>
          </div>
        </template>
      </AppDataTable>
    </article>
  </section>
</template>
