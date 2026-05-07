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

const auth = useVendorAuth()

function formatCurrency(amount: string): string {
  const parsed = Number.parseFloat(amount)

  if (Number.isNaN(parsed)) {
    return amount
  }

  return parsed.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
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

const { data, pending, error, refresh } = await useAsyncData(
  'vendor-balance-page',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ balance: VendorBalance }>('/api/vendor/balance', {
      method: 'GET',
      headers: auth.authHeaders()
    })
  },
  {
    server: false,
    default: () => ({
      balance: {
        pendingAmount: '0',
        availableAmount: '0',
        paidAmount: '0',
        asOf: new Date().toISOString()
      }
    })
  }
)
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <p class="auth-kicker">
        Vendor balances
      </p>
      <h1 class="auth-title">
        Balance snapshot
      </h1>
      <p class="auth-copy">
        See available, pending, and paid totals backed by the live ledger.
      </p>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading balance"
      description="Fetching your current balance snapshot."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load balance"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Balance request failed.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="vendor-summary-grid">
        <article class="admin-card">
          <p class="admin-card__label">
            Available
          </p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.availableAmount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Pending
          </p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.pendingAmount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Paid
          </p>
          <p class="admin-card__value">
            {{ formatCurrency(data.balance.paidAmount) }}
          </p>
        </article>
      </section>

      <article class="admin-page__header">
        <p class="admin-card__label">
          Snapshot time
        </p>
        <p class="auth-copy auth-copy--compact">
          {{ formatDate(data.balance.asOf) }}
        </p>
      </article>
    </template>
  </section>
</template>
