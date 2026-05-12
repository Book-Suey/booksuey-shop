<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface AdminImportRecord {
  batchId: string
  status: 'completed' | 'failed'
  summary: {
    rejected: number
  }
}

const auth = useAdminAuth()

const { data, pending, error, refresh } = await useAsyncData(
  'admin-dashboard-overview',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ imports: AdminImportRecord[] }>(
      '/api/admin/imports',
      {
        method: 'GET',
        headers: auth.authHeaders(),
        query: { limit: 25 }
      }
    )
  },
  {
    server: false,
    default: () => ({ imports: [] as AdminImportRecord[] })
  }
)

const cards = computed(() => {
  const imports = data.value.imports
  const failedImports = imports.filter(
    importBatch => importBatch.status === 'failed'
  ).length
  const flaggedImports = imports.filter(
    importBatch => importBatch.summary.rejected > 0
  ).length

  return [
    {
      label: 'Recent imports',
      value: String(imports.length),
      status: imports.length > 0 ? 'completed' : 'pending',
      href: '/admin/imports'
    },
    {
      label: 'Flagged batches',
      value: String(flaggedImports),
      status: flaggedImports > 0 ? 'pending' : 'completed',
      href: '/admin/imports'
    },
    {
      label: 'Failed batches',
      value: String(failedImports),
      status: failedImports > 0 ? 'failed' : 'completed',
      href: '/admin/imports/upload'
    }
  ]
})
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">
        Operations overview
      </h1>
      <p class="auth-copy">
        Review operational entry points and jump into imports, vendors, and
        payout workflows.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/imports/upload"
          class="portal-button portal-button--primary"
        >
          Upload sales CSV
        </NuxtLink>
        <NuxtLink
          to="/admin/imports"
          class="portal-button portal-button--secondary"
        >
          Review import history
        </NuxtLink>
        <NuxtLink
          to="/admin/audit"
          class="portal-button portal-button--secondary"
        >
          Open audit trail
        </NuxtLink>
        <NuxtLink
          to="/admin/payout-requests/payout-failures"
          class="portal-button portal-button--secondary"
        >
          Open payout failures
        </NuxtLink>
        <NuxtLink
          to="/admin/user-guide"
          class="portal-button portal-button--secondary"
        >
          Open admin user guide
        </NuxtLink>
      </div>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading operations overview"
      description="Fetching recent import activity for the admin dashboard."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load operations overview"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Dashboard request failed.'
      "
      @retry="refresh"
    />

    <div
      v-else
      class="admin-cards"
    >
      <article
        v-for="card in cards"
        :key="card.label"
        class="admin-card"
      >
        <p class="admin-card__label">
          {{ card.label }}
        </p>
        <p class="admin-card__value">
          {{ card.value }}
        </p>
        <AppStatusBadge :status="card.status" />
        <NuxtLink :to="card.href"> Open workflow </NuxtLink>
      </article>
    </div>

    <article class="vendor-panel">
      <h2>Implementation focus</h2>
      <p>
        Vendor auth, vendor financial pages, admin authentication, and vendor
        management are in place. Sales import, payout queue, audit trail, and
        payout failure reconciliation pages are now available workflows.
      </p>
    </article>
  </section>
</template>
