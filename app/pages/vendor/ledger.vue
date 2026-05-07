<script setup lang="ts">
definePageMeta({
  middleware: 'vendor-auth',
  layout: 'vendor'
})

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
    sale?: {
      soldAt: string
      title: string
      quantity: number
      unit: string
      discount: string
      extended: string
    }
  }
}

const auth = useVendorAuth()

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

const { data, pending, error, refresh } = await useAsyncData(
  'vendor-ledger-page',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ ledgerEntries: VendorLedgerEntry[] }>(
      '/api/vendor/ledger',
      {
        method: 'GET',
        headers: auth.authHeaders()
      }
    )
  },
  {
    server: false,
    default: () => ({ ledgerEntries: [] as VendorLedgerEntry[] })
  }
)
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <p class="auth-kicker">
        Vendor ledger
      </p>
      <h1 class="auth-title">
        Balance movement log
      </h1>
      <p class="auth-copy">
        Append-only ledger entries showing every credit, reservation, release,
        and payout.
      </p>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading ledger"
      description="Fetching ledger entries for your account."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load ledger"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Ledger request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="data.ledgerEntries.length === 0"
      title="No ledger activity"
      description="Your ledger will populate after sales imports and payout requests."
    />

    <article
      v-else
      class="vendor-panel"
    >
      <div class="vendor-feed">
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
            <p
              v-if="entry.reference.sale"
              class="vendor-feed__meta"
            >
              {{ entry.reference.sale.title }} •
              {{ formatDate(entry.reference.sale.soldAt) }}
            </p>
          </div>

          <div class="vendor-feed__right">
            <p>{{ formatDate(entry.occurredAt) }}</p>
            <p>{{ formatCurrency(entry.amount, entry.currency) }}</p>
            <AppStatusBadge :status="entry.balanceImpact" />
          </div>
        </div>
      </div>
    </article>
  </section>
</template>
