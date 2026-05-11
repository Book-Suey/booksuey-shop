<script setup lang="ts">
definePageMeta({
  middleware: 'vendor-auth',
  layout: 'vendor'
})

interface VendorBalance {
  pendingAmount: string
  availableAmount: string
  paidAmount: string
  asOf: string
}

interface VendorSale {
  saleRecordId: string
  soldAt: string
  title: string
  grossAmount: string
  commissionAmount: string
}

interface VendorLedgerEntry {
  entryId: string
  entryType: string
  amount: string
  balanceImpact: string
  balanceAfter: string
  currency: string
  occurredAt: string
  description?: string
  sale?: {
    soldAt: string
    title: string
  }
}

interface VendorPayoutRequest {
  payoutRequestId: string
  amount: string
  currency: string
  status: string
  requestedAt: string
}

const auth = useVendorAuth()
const hasMounted = ref(false)

function formatCurrency(amount: string, currency = 'USD'): string {
  const parsed = Number.parseFloat(amount)

  if (Number.isNaN(parsed)) {
    return amount
  }

  return parsed.toLocaleString('en-US', {
    style: 'currency',
    currency
  })
}

function formatDate(value: string): string {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatLedgerEntryType(entryType: string): string {
  const labels: Record<string, string> = {
    sale: 'Sale Posted',
    reservation: 'Payout Reserved',
    release: 'Payout Reversed',
    paid: 'Payout Paid'
  }

  return labels[entryType] || entryType
}

const { data, pending, error, refresh } = await useAsyncData(
  'vendor-overview-dashboard',
  async () => {
    await auth.ensureInitialized()
    const headers = auth.authHeaders()

    const [balanceResponse, salesResponse, ledgerResponse, payoutsResponse]
      = await Promise.all([
        $fetch<{ balance: VendorBalance }>('/api/vendor/balance', {
          method: 'GET',
          headers
        }),
        $fetch<{ sales: VendorSale[] }>('/api/vendor/sales', {
          method: 'GET',
          headers
        }),
        $fetch<{ ledgerEntries: VendorLedgerEntry[] }>('/api/vendor/ledger', {
          method: 'GET',
          headers
        }),
        $fetch<{ payoutRequests: VendorPayoutRequest[] }>(
          '/api/vendor/payout-requests',
          { method: 'GET', headers }
        )
      ])

    return {
      balance: balanceResponse.balance,
      sales: salesResponse.sales.slice(0, 5),
      ledgerEntries: ledgerResponse.ledgerEntries.slice(0, 5),
      payoutRequests: payoutsResponse.payoutRequests.slice(0, 5)
    }
  },
  {
    server: false,
    immediate: false,
    default: () => ({
      balance: {
        pendingAmount: '0',
        availableAmount: '0',
        paidAmount: '0',
        asOf: new Date().toISOString()
      },
      sales: [] as VendorSale[],
      ledgerEntries: [] as VendorLedgerEntry[],
      payoutRequests: [] as VendorPayoutRequest[]
    })
  }
)

onMounted(async () => {
  hasMounted.value = true
  await refresh()
})

const salesColumns = [
  { key: 'soldAt', label: 'Sold At' },
  { key: 'title', label: 'Title' },
  { key: 'grossAmount', label: 'Gross' },
  { key: 'commissionAmount', label: 'Commission' }
]

const payoutColumns = [
  { key: 'payoutRequestId', label: 'Request' },
  { key: 'requestedAt', label: 'Requested At' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' }
]
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <h1 class="auth-title">
        Financial overview
      </h1>
      <p class="auth-copy">
        Live balance, sales activity, ledger entries, and payout request status.
      </p>
      <div class="vendor-actions">
        <NuxtLink
          to="/vendor/payouts"
          class="portal-button portal-button--primary"
        >
          Request payout
        </NuxtLink>
        <NuxtLink
          to="/vendor/balance#ledger"
          class="portal-button portal-button--secondary"
        >
          View full ledger
        </NuxtLink>
      </div>
    </header>

    <AppLoadingState
      v-if="hasMounted && pending"
      title="Loading overview"
      description="Fetching your latest vendor financial data."
    />

    <AppErrorState
      v-else-if="hasMounted && error"
      title="Unable to load dashboard"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Dashboard data request failed.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="vendor-summary-grid">
        <article class="admin-card">
          <p class="admin-card__label">
            Available balance
          </p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.availableAmount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Pending balance
          </p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.pendingAmount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Paid to date
          </p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.paidAmount) }}
          </p>
        </article>
      </section>

      <article class="admin-page__header">
        <p class="admin-card__label">
          Balance as of
        </p>
        <p class="auth-copy auth-copy--compact">
          {{ formatDate(data.balance.asOf) }}
        </p>
      </article>

      <article class="vendor-panel">
        <div class="vendor-panel__title">
          <h2>Recent sales</h2>
          <NuxtLink to="/vendor/sales">View all</NuxtLink>
        </div>
        <AppEmptyState
          v-if="data.sales.length === 0"
          title="No sales yet"
          description="Imported sales will appear here once available."
        />
        <AppDataTable
          v-else
          :columns="salesColumns"
          :rows="data.sales"
          :row-key="(row) => row.saleRecordId"
        >
          <template #cell:soldAt="{ row }">
            {{ formatDate(row.soldAt as string) }}
          </template>
          <template #cell:grossAmount="{ row }">
            {{ formatCurrency(row.grossAmount as string) }}
          </template>
          <template #cell:commissionAmount="{ row }">
            {{ formatCurrency(row.commissionAmount as string) }}
          </template>
        </AppDataTable>
      </article>

      <article class="vendor-panel">
        <div class="vendor-panel__title">
          <h2>Recent ledger entries</h2>
          <NuxtLink to="/vendor/balance#ledger">View all</NuxtLink>
        </div>
        <AppEmptyState
          v-if="data.ledgerEntries.length === 0"
          title="No ledger entries yet"
          description="Ledger movement appears after imports or payouts."
        />
        <div
          v-else
          class="vendor-feed"
        >
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
              <p
                v-if="entry.sale"
                class="vendor-feed__meta"
              >
                {{ entry.sale.title }} • {{ formatDate(entry.sale.soldAt) }}
              </p>
              <p
                v-if="entry.description"
                class="vendor-feed__meta"
              >
                {{ entry.description }}
              </p>
            </div>
            <div class="vendor-feed__right">
              <p class="vendor-feed__line">
                <span class="vendor-feed__line-label">Transaction amount</span>
                <span>{{
                  formatCurrency(entry.balanceImpact, entry.currency)
                }}</span>
              </p>
              <p class="vendor-feed__line">
                <span class="vendor-feed__line-label">Balance after</span>
                <span>{{
                  formatCurrency(entry.balanceAfter, entry.currency)
                }}</span>
              </p>
            </div>
          </div>
        </div>
      </article>

      <article class="vendor-panel">
        <div class="vendor-panel__title">
          <h2>Recent payout requests</h2>
          <NuxtLink to="/vendor/payouts">Manage payouts</NuxtLink>
        </div>
        <AppEmptyState
          v-if="data.payoutRequests.length === 0"
          title="No payout requests"
          description="Submit your first payout request when funds are available."
        />
        <AppDataTable
          v-else
          :columns="payoutColumns"
          :rows="data.payoutRequests"
          :row-key="(row) => row.payoutRequestId"
        >
          <template #cell:requestedAt="{ row }">
            {{ formatDate(row.requestedAt as string) }}
          </template>
          <template #cell:amount="{ row }">
            {{ formatCurrency(row.amount as string, row.currency as string) }}
          </template>
          <template #cell:status="{ row }">
            <AppStatusBadge :status="row.status as string" />
          </template>
        </AppDataTable>
      </article>
    </template>
  </section>
</template>
