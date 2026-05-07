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

interface VendorPayoutRequest {
  payoutRequestId: string
  amount: string
  currency: string
  status: string
  requestedAt: string
}

const auth = useVendorAuth()
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const form = reactive({
  amount: ''
})

const columns = [
  { key: 'payoutRequestId', label: 'Request' },
  { key: 'requestedAt', label: 'Requested At' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' }
]

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
  'vendor-payouts-page',
  async () => {
    await auth.ensureInitialized()
    const headers = auth.authHeaders()

    const [balanceResponse, requestsResponse] = await Promise.all([
      $fetch<{ balance: VendorBalance }>('/api/vendor/balance', {
        method: 'GET',
        headers
      }),
      $fetch<{ payoutRequests: VendorPayoutRequest[] }>(
        '/api/vendor/payout-requests',
        {
          method: 'GET',
          headers
        }
      )
    ])

    return {
      balance: balanceResponse.balance,
      payoutRequests: requestsResponse.payoutRequests
    }
  },
  {
    server: false,
    default: () => ({
      balance: {
        pendingAmount: '0',
        availableAmount: '0',
        paidAmount: '0',
        asOf: new Date().toISOString()
      },
      payoutRequests: [] as VendorPayoutRequest[]
    })
  }
)

async function submitPayoutRequest(): Promise<void> {
  submitError.value = null
  successMessage.value = null

  const normalizedAmount = form.amount.trim()
  if (!normalizedAmount) {
    submitError.value = 'Enter an amount to request.'
    return
  }

  isSubmitting.value = true

  try {
    const response = await $fetch<{
      payoutRequest: VendorPayoutRequest
      balance: VendorBalance
    }>('/api/vendor/payout-requests', {
      method: 'POST',
      headers: auth.authHeaders(),
      body: {
        amount: normalizedAmount
      }
    })

    data.value.payoutRequests.unshift(response.payoutRequest)
    data.value.balance = response.balance
    form.amount = ''
    successMessage.value = 'Payout request submitted.'
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    submitError.value
      = statusMessage || 'Unable to submit payout request right now.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <p class="auth-kicker">
        Vendor payouts
      </p>
      <h1 class="auth-title">
        Request a payout
      </h1>
      <p class="auth-copy">
        Submit requests against available funds and track payout status history.
      </p>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading payouts"
      description="Fetching payout history and current available balance."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load payouts"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Payout request data failed to load.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="vendor-summary-grid">
        <article class="admin-card">
          <p class="admin-card__label">
            Available to request
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

      <article class="vendor-panel">
        <h2>New request</h2>
        <form
          class="auth-form"
          @submit.prevent="submitPayoutRequest"
        >
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
            >
          </label>

          <p
            v-if="submitError"
            class="auth-error"
          >
            {{ submitError }}
          </p>

          <p
            v-if="successMessage"
            class="auth-success"
          >
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
