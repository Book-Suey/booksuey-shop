<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface AdminPayoutRequest {
  payoutRequestId: string
  vendorId: string
  amount: string
  currency: string
  status:
    | 'requested'
    | 'approved'
    | 'disbursing'
    | 'paid'
    | 'failed'
    | 'rejected'
  requiresAction: boolean
  requestedAt: string
  approvedAt?: string
  rejectedAt?: string
  disbursingAt?: string
  paidAt?: string
  failedAt?: string
}

const auth = useAdminAuth()

const filters = reactive({
  status: 'active',
  dateFrom: '',
  dateTo: ''
})

const columns = [
  { key: 'payoutRequestId', label: 'Request ID' },
  { key: 'vendorId', label: 'Vendor ID' },
  { key: 'amount', label: 'Amount' },
  { key: 'status', label: 'Status' },
  { key: 'requestedAt', label: 'Requested' },
  { key: 'actions', label: 'Actions' }
]

function toIsoBoundary(
  value: string,
  boundary: 'start' | 'end'
): string | undefined {
  if (!value) {
    return undefined
  }

  const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'
  return new Date(`${value}${suffix}`).toISOString()
}

function formatDate(value: string): string {
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

function formatCurrency(amount: string): string {
  const num = parseFloat(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num)
}

const { data, pending, error, refresh } = await useAsyncData(
  'admin-payout-requests-list',
  async () => {
    await auth.ensureInitialized()

    const query: Record<string, string | number> = {
      limit: 100
    }

    if (filters.status === 'active') {
      query.status = 'requested,approved,disbursing'
    } else if (filters.status !== 'all') {
      query.status = filters.status
    }

    const dateFrom = toIsoBoundary(filters.dateFrom, 'start')
    const dateTo = toIsoBoundary(filters.dateTo, 'end')

    if (dateFrom) {
      query.dateFrom = dateFrom
    }

    if (dateTo) {
      query.dateTo = dateTo
    }

    return await $fetch<{ payoutRequests: AdminPayoutRequest[] }>(
      '/api/admin/payout-requests',
      {
        method: 'GET',
        headers: auth.authHeaders(),
        query
      }
    )
  },
  {
    server: false,
    watch: [() => filters.status, () => filters.dateFrom, () => filters.dateTo],
    default: () => ({ payoutRequests: [] as AdminPayoutRequest[] })
  }
)

const metrics = computed(() => {
  const payouts = data.value.payoutRequests

  return {
    total: payouts.length,
    requiresAction: payouts.filter(p => p.requiresAction).length,
    approved: payouts.filter(p => p.status === 'approved').length,
    disbursing: payouts.filter(p => p.status === 'disbursing').length
  }
})
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">
        Admin payout operations
      </p>
      <h1 class="auth-title">
        Payout queue
      </h1>
      <p class="auth-copy">
        Review pending payout requests, approve or reject, and execute
        disbursements to vendors.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/payout-failures"
          class="portal-button portal-button--secondary"
        >
          Review payout failures
        </NuxtLink>
        <NuxtLink
          to="/admin/audit?entityType=PayoutRequest"
          class="portal-button portal-button--secondary"
        >
          View payout audit trail
        </NuxtLink>
      </div>

      <div class="admin-cards">
        <article class="admin-card">
          <p class="admin-card__label">
            Active queue
          </p>
          <p class="admin-card__value">
            {{ metrics.total }}
          </p>
        </article>
        <article class="admin-card">
          <p class="admin-card__label">
            Requires action
          </p>
          <p class="admin-card__value">
            {{ metrics.requiresAction }}
          </p>
        </article>
        <article class="admin-card">
          <p class="admin-card__label">
            Approved
          </p>
          <p class="admin-card__value">
            {{ metrics.approved }}
          </p>
        </article>
        <article class="admin-card">
          <p class="admin-card__label">
            Disbursing
          </p>
          <p class="admin-card__value">
            {{ metrics.disbursing }}
          </p>
        </article>
      </div>
    </header>

    <article class="vendor-panel stack-grid">
      <div>
        <h2>Filter payout queue</h2>
        <p class="panel-copy">
          Refine the visible payouts by status and date.
        </p>
      </div>

      <form class="auth-form">
        <label>
          <span>Status</span>
          <select v-model="filters.status">
            <option value="active">
              Active (requested, approved, disbursing)
            </option>
            <option value="requested">Requested only</option>
            <option value="approved">Approved only</option>
            <option value="disbursing">Disbursing only</option>
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>

        <label>
          <span>From date</span>
          <input
            v-model="filters.dateFrom"
            type="date"
          >
        </label>

        <label>
          <span>To date</span>
          <input
            v-model="filters.dateTo"
            type="date"
          >
        </label>
      </form>
    </article>

    <article class="vendor-panel">
      <AppLoadingState
        v-if="pending"
        title="Loading payout queue"
        description="Fetching pending and active payout requests."
      />

      <AppErrorState
        v-else-if="error"
        title="Unable to load payout queue"
        :message="
          (error as { statusMessage?: string })?.statusMessage
            || 'Payout queue request failed.'
        "
        @retry="refresh"
      />

      <AppEmptyState
        v-else-if="data.payoutRequests.length === 0"
        title="No payouts in queue"
        description="When vendors request payouts, they will appear here for review."
      />

      <div
        v-else
        class="table-shell"
      >
        <table>
          <thead>
            <tr>
              <th
                v-for="col in columns"
                :key="col.key"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="payout in data.payoutRequests"
              :key="payout.payoutRequestId"
            >
              <td>{{ payout.payoutRequestId }}</td>
              <td>{{ payout.vendorId }}</td>
              <td>{{ formatCurrency(payout.amount) }}</td>
              <td>
                <AppStatusBadge :status="payout.status" />
              </td>
              <td>{{ formatDate(payout.requestedAt) }}</td>
              <td>
                <NuxtLink
                  :to="`/admin/payout-requests/${payout.payoutRequestId}`"
                  class="portal-button portal-button--secondary"
                >
                  Review
                </NuxtLink>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>
