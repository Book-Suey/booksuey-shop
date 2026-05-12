<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface AuditEventRecord {
  auditEventId: string
  actorId: string
  actorDisplayName: string
  actorRole: 'admin' | 'vendor'
  action: string
  entityType: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  createdAt: string
}

const auth = useAdminAuth()
const route = useRoute()

const filters = reactive({
  action: (route.query.action as string) ?? '',
  entityType: (route.query.entityType as string) ?? '',
  entityId: (route.query.entityId as string) ?? '',
  actorRole: (route.query.actorRole as string) ?? 'all',
  dateFrom: (route.query.dateFrom as string) ?? '',
  dateTo: (route.query.dateTo as string) ?? '',
  limit: Number(route.query.limit ?? 100)
})

const columns = [
  { key: 'createdAt', label: 'Created' },
  { key: 'action', label: 'Action' },
  { key: 'entity', label: 'Entity' },
  { key: 'actor', label: 'Actor' },
  { key: 'change', label: 'Change' }
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

function compactJson(value: Record<string, unknown> | undefined): string {
  if (!value || Object.keys(value).length === 0) {
    return 'No snapshot'
  }

  return JSON.stringify(value)
}

const { data, pending, error, refresh } = await useAsyncData(
  'admin-audit-events',
  async () => {
    await auth.ensureInitialized()

    const query: Record<string, string | number> = {
      limit: filters.limit
    }

    if (filters.action.trim()) {
      query.action = filters.action.trim()
    }

    if (filters.entityType.trim()) {
      query.entityType = filters.entityType.trim()
    }

    if (filters.entityId.trim()) {
      query.entityId = filters.entityId.trim()
    }

    if (filters.actorRole !== 'all') {
      query.actorRole = filters.actorRole
    }

    const dateFrom = toIsoBoundary(filters.dateFrom, 'start')
    const dateTo = toIsoBoundary(filters.dateTo, 'end')

    if (dateFrom) {
      query.dateFrom = dateFrom
    }

    if (dateTo) {
      query.dateTo = dateTo
    }

    return await $fetch<{ auditEvents: AuditEventRecord[] }>('/api/admin/audit', {
      method: 'GET',
      query
    })
  },
  {
    watch: [
      () => filters.action,
      () => filters.entityType,
      () => filters.entityId,
      () => filters.actorRole,
      () => filters.dateFrom,
      () => filters.dateTo,
      () => filters.limit
    ],
    default: () => ({ auditEvents: [] as AuditEventRecord[] })
  }
)

const metrics = computed(() => {
  const events = data.value.auditEvents

  return {
    total: events.length,
    adminActions: events.filter(event => event.actorRole === 'admin').length,
    vendorActions: events.filter(event => event.actorRole === 'vendor').length,
    uniqueEntities: new Set(events.map(event => `${event.entityType}:${event.entityId}`)).size
  }
})
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">
        Audit trail
      </h1>
      <p class="auth-copy">
        Inspect action-level history for imports, payouts, and vendor operations
        with searchable filters.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/payout-requests/payout-failures"
          class="portal-button portal-button--secondary"
        >
          View payout failures
        </NuxtLink>
      </div>
    </header>

    <section class="admin-cards">
      <article class="admin-card">
        <p class="admin-card__label">
          Events in view
        </p>
        <p class="admin-card__value">
          {{ metrics.total }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">
          Admin events
        </p>
        <p class="admin-card__value">
          {{ metrics.adminActions }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">
          Vendor events
        </p>
        <p class="admin-card__value">
          {{ metrics.vendorActions }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">
          Unique entities
        </p>
        <p class="admin-card__value">
          {{ metrics.uniqueEntities }}
        </p>
      </article>
    </section>

    <article class="vendor-panel">
      <h2>Filters</h2>

      <form class="auth-form filter-grid">
        <label>
          <span>Action</span>
          <input
            v-model="filters.action"
            type="text"
            placeholder="payout_approved"
          >
        </label>

        <label>
          <span>Entity type</span>
          <input
            v-model="filters.entityType"
            type="text"
            placeholder="PayoutRequest"
          >
        </label>

        <label>
          <span>Entity ID</span>
          <input
            v-model="filters.entityId"
            type="text"
            placeholder="payout_123"
          >
        </label>

        <label>
          <span>Actor role</span>
          <select v-model="filters.actorRole">
            <option value="all">All</option>
            <option value="admin">Admin</option>
            <option value="vendor">Vendor</option>
          </select>
        </label>

        <label>
          <span>From</span>
          <input
            v-model="filters.dateFrom"
            type="date"
          >
        </label>

        <label>
          <span>To</span>
          <input
            v-model="filters.dateTo"
            type="date"
          >
        </label>

        <label>
          <span>Limit</span>
          <input
            v-model.number="filters.limit"
            type="number"
            min="1"
            max="200"
            step="1"
          >
        </label>
      </form>
    </article>

    <AppLoadingState
      v-if="pending"
      title="Loading audit history"
      description="Fetching event history with the selected filters."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load audit history"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Audit history request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="data.auditEvents.length === 0"
      title="No audit events found"
      description="Adjust filters to broaden your search criteria."
    />

    <article
      v-else
      class="vendor-panel"
    >
      <h2>Event history</h2>

      <AppDataTable
        :columns="columns"
        :rows="data.auditEvents"
        :row-key="(row) => row.auditEventId"
        :mobile-columns="['createdAt', 'action', 'actor', 'entity', 'change']"
      >
        <template #cell:createdAt="{ row }">
          {{ formatDate(row.createdAt as string) }}
        </template>

        <template #cell:entity="{ row }">
          <div>
            <p>{{ row.entityType as string }}</p>
            <p class="panel-copy">
              {{ row.entityId as string }}
            </p>
          </div>
        </template>

        <template #cell:actor="{ row }">
          <div>
            <AppStatusBadge :status="row.actorRole as string" />
            <p class="panel-copy">
              {{ row.actorDisplayName as string }}
            </p>
          </div>
        </template>

        <template #cell:change="{ row }">
          <details>
            <summary>View snapshots</summary>
            <p class="panel-copy">
              Before: {{ compactJson(row.before as Record<string, unknown> | undefined) }}
            </p>
            <p class="panel-copy">
              After: {{ compactJson(row.after as Record<string, unknown> | undefined) }}
            </p>
          </details>
        </template>
      </AppDataTable>
    </article>
  </section>
</template>
