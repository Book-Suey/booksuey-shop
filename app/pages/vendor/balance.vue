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

interface VendorLedgerEntry {
  entryId: string;
  entryType: string;
  amount: string;
  balanceImpact: string;
  balanceAfter: string;
  currency: string;
  occurredAt: string;
  description?: string;
  sale?: {
    soldAt: string;
    title: string;
  };
}

const auth = useVendorAuth();
const hasMounted = ref(false);

function formatCurrency(amount: string): string {
  const parsed = Number.parseFloat(amount);

  if (Number.isNaN(parsed)) {
    return amount;
  }

  return parsed.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
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

function formatLedgerEntryType(entryType: string): string {
  const labels: Record<string, string> = {
    sale: "Sale Posted",
    reservation: "Payout Reserved",
    release: "Payout Reversed",
    paid: "Payout Paid",
  };

  return labels[entryType] || entryType;
}

const { data, pending, error, refresh } = await useAsyncData(
  "vendor-balance-page",
  async () => {
    await auth.ensureInitialized();

    const [balanceResponse, ledgerResponse] = await Promise.all([
      $fetch<{ balance: VendorBalance }>("/api/vendor/balance", {
        method: "GET",
        headers: auth.authHeaders(),
      }),
      $fetch<{ ledgerEntries: VendorLedgerEntry[] }>("/api/vendor/ledger", {
        method: "GET",
        headers: auth.authHeaders(),
      }),
    ]);

    return {
      balance: balanceResponse.balance,
      ledgerEntries: ledgerResponse.ledgerEntries,
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
      ledgerEntries: [] as VendorLedgerEntry[],
    }),
  },
);

onMounted(async () => {
  hasMounted.value = true;
  await refresh();
});
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <h1 class="auth-title">Balance &amp; ledger</h1>
      <p class="auth-copy">See all balance affecting transactions.</p>
    </header>

    <AppLoadingState
      v-if="hasMounted && pending"
      title="Loading balance and ledger"
      description="Fetching your current balance snapshot and ledger activity."
    />

    <AppErrorState
      v-else-if="hasMounted && error"
      title="Unable to load balance and ledger"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Balance and ledger request failed.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="vendor-summary-grid">
        <article class="admin-card">
          <p class="admin-card__label">Available</p>
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

      <article class="admin-page__header">
        <p class="admin-card__label">Snapshot time</p>
        <p class="auth-copy auth-copy--compact">
          {{ formatDate(data.balance.asOf) }}
        </p>
      </article>

      <article id="ledger" class="vendor-panel">
        <div class="vendor-panel__title">
          <h2>Ledger entries</h2>
        </div>

        <AppEmptyState
          v-if="data.ledgerEntries.length === 0"
          title="No ledger activity"
          description="Your ledger will populate after sales imports and payout requests."
        />

        <div v-else class="vendor-feed">
          <div
            v-for="entry in data.ledgerEntries"
            :key="entry.entryId"
            class="vendor-feed__row"
          >
            <div>
              <p class="vendor-feed__title">
                {{ formatLedgerEntryType(entry.entryType) }}
              </p>
              <p class="vendor-feed__meta">
                {{ formatDate(entry.occurredAt) }}
              </p>
              <p v-if="entry.sale" class="vendor-feed__meta">
                {{ entry.sale.title }} •
                {{ formatDate(entry.sale.soldAt) }}
              </p>
              <p v-if="entry.description" class="vendor-feed__meta">
                {{ entry.description }}
              </p>
            </div>

            <div class="vendor-feed__right">
              <p class="vendor-feed__line">
                <span class="vendor-feed__line-label">Transaction amount</span>
                <span>{{ formatCurrency(entry.balanceImpact) }}</span>
              </p>
              <p class="vendor-feed__line">
                <span class="vendor-feed__line-label">Balance after</span>
                <span>{{ formatCurrency(entry.balanceAfter) }}</span>
              </p>
            </div>
          </div>
        </div>
      </article>
    </template>
  </section>
</template>
