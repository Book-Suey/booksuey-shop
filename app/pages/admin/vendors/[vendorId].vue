<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface VendorRecord {
  vendorId: string
  legalName: string
  displayName: string
  email: string
  phone?: string
  status: 'active' | 'inactive'
  approvedVendorId?: string
}

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
  batch: string
  grossAmount: string
  commissionAmount: string
  currency: string
}

interface VendorLedgerEntry {
  entryId: string
  entryType: string
  amount: string
  balanceImpact: string
  currency: string
  occurredAt: string
  reference: {
    referenceType: string
    referenceId: string
  }
}

interface VendorPayoutRequest {
  payoutRequestId: string
  amount: string
  currency: string
  status: string
  requestedAt: string
}

const route = useRoute()
const auth = useAdminAuth()

const vendorId = computed(() => String(route.params.vendorId || ''))

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

function formatDateTime(value: string): string {
  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

const { data, pending, error, refresh } = await useAsyncData(
  'admin-vendor-overview-detail',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{
      vendor: VendorRecord
      balance: VendorBalance
      sales: VendorSale[]
      ledgerEntries: VendorLedgerEntry[]
      payoutRequests: VendorPayoutRequest[]
    }>(`/api/admin/vendors/${vendorId.value}/overview`, {
      method: 'GET'
    })
  },
  {
    watch: [vendorId],
    default: () => ({
      vendor: {
        vendorId: '',
        legalName: '',
        displayName: '',
        email: '',
        phone: '',
        status: 'active',
        approvedVendorId: ''
      },
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

const salesColumns = [
  { key: 'batch', label: 'Period' },
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
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">
        Vendor financial overview
      </h1>
      <p class="auth-copy">
        Sales, ledger, balances, and payout activity for
        <strong>{{ data.vendor.displayName || data.vendor.vendorId }}</strong>.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/vendors"
          class="portal-button portal-button--secondary"
        >
          Back to list
        </NuxtLink>
      </div>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading vendor"
      description="Fetching vendor details."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load vendor"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Request failed.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="admin-cards">
        <article class="admin-card">
          <p class="admin-card__label">
            Vendor ID
          </p>
          <p class="panel-copy">
            <strong>{{ data.vendor.vendorId }}</strong>
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Status
          </p>
          <AppStatusBadge :status="data.vendor.status" />
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Approved Vendor ID
          </p>
          <p class="panel-copy">
            <strong>{{ data.vendor.approvedVendorId || "—" }}</strong>
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Contact
          </p>
          <p class="panel-copy">
            <strong>{{ data.vendor.email }}</strong>
            <br>
            {{ data.vendor.phone || "No phone on file" }}
          </p>
        </article>
      </section>

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
          {{ formatDateTime(data.balance.asOf) }}
        </p>
      </article>

      <article class="vendor-panel">
        <div class="vendor-panel__title">
          <h2>Recent sales</h2>
        </div>

        <AppEmptyState
          v-if="data.sales.length === 0"
          title="No sales yet"
          description="No imported sales are linked to this vendor yet."
        />

        <AppDataTable
          v-else
          :columns="salesColumns"
          :rows="data.sales"
          :row-key="(row) => row.saleRecordId"
          :mobile-columns="[
            'batch',
            'title',
            'soldAt',
            'grossAmount',
            'commissionAmount'
          ]"
        >
          <template #cell:soldAt="{ row }">
            {{ formatDate(row.soldAt as string) }}
          </template>
          <template #cell:grossAmount="{ row }">
            {{
              formatCurrency(row.grossAmount as string, row.currency as string)
            }}
          </template>
          <template #cell:commissionAmount="{ row }">
            {{
              formatCurrency(
                row.commissionAmount as string,
                row.currency as string
              )
            }}
          </template>
        </AppDataTable>
      </article>

      <article class="vendor-panel">
        <div class="vendor-panel__title">
          <h2>Recent ledger entries</h2>
        </div>

        <AppEmptyState
          v-if="data.ledgerEntries.length === 0"
          title="No ledger entries yet"
          description="Ledger movement appears after sales imports or payout actions."
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
                {{ entry.entryType }}
              </p>
              <p class="vendor-feed__meta">
                {{ entry.reference.referenceType }} •
                {{ entry.reference.referenceId }}
              </p>
            </div>
            <div class="vendor-feed__right">
              <p class="vendor-feed__line">
                <span class="vendor-feed__line-label">When</span>
                <span>{{ formatDateTime(entry.occurredAt) }}</span>
              </p>
              <p class="vendor-feed__line">
                <span class="vendor-feed__line-label">Amount</span>
                <span>{{ formatCurrency(entry.amount, entry.currency) }}</span>
              </p>
              <div class="vendor-feed__line vendor-feed__line--badge">
                <span class="vendor-feed__line-label">Impact</span>
                <AppStatusBadge :status="entry.balanceImpact" />
              </div>
            </div>
          </div>
        </div>
      </article>

      <article class="vendor-panel">
        <div class="vendor-panel__title">
          <h2>Recent payout requests</h2>
        </div>

        <AppEmptyState
          v-if="data.payoutRequests.length === 0"
          title="No payout requests"
          description="No payouts have been requested for this vendor yet."
        />

        <AppDataTable
          v-else
          :columns="payoutColumns"
          :rows="data.payoutRequests"
          :row-key="(row) => row.payoutRequestId"
          :mobile-columns="[
            'payoutRequestId',
            'status',
            'amount',
            'requestedAt'
          ]"
        >
          <template #cell:requestedAt="{ row }">
            {{ formatDateTime(row.requestedAt as string) }}
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
