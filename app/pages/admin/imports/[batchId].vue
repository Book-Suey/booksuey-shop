<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface BatchError {
  code: string
  rowNumber: number
  reason: string
  hint: string
}

interface BatchDetail {
  batchId: string
  sourcePeriod: string
  uploadedBy: string
  uploadedAt: string
  status: 'completed' | 'failed'
  checksum: string
  summary: {
    total: number
    accepted: number
    rejected: number
    duplicates: number
  }
  errors: BatchError[]
  unmappedSources: string[]
}

const auth = useAdminAuth()
const route = useRoute()

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

const { data, pending, error, refresh } = await useAsyncData(
  () => `admin-import-batch-${route.params.batchId as string}`,
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ batch: BatchDetail }>(
      `/api/admin/sales/${route.params.batchId as string}`,
      {
        method: 'GET',
        headers: auth.authHeaders()
      }
    )
  },
  {
    server: false,
    default: () => ({
      batch: {
        batchId: '',
        sourcePeriod: '',
        uploadedBy: '',
        uploadedAt: new Date().toISOString(),
        status: 'completed' as const,
        checksum: '',
        summary: {
          total: 0,
          accepted: 0,
          rejected: 0,
          duplicates: 0
        },
        errors: [] as BatchError[],
        unmappedSources: [] as string[]
      }
    })
  }
)
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">
        Admin sales imports
      </p>
      <h1 class="auth-title">
        Batch {{ route.params.batchId }}
      </h1>
      <p class="auth-copy">
        Inspect import metadata, row-level errors, and unmapped sources for this
        batch.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/imports"
          class="portal-button portal-button--secondary"
        >
          Back to import history
        </NuxtLink>
        <NuxtLink
          :to="`/admin/audit?entityType=SalesImportBatch&entityId=${route.params.batchId as string}`"
          class="portal-button portal-button--secondary"
        >
          View batch audit events
        </NuxtLink>
        <NuxtLink
          to="/admin/imports/upload"
          class="portal-button portal-button--primary"
        >
          Upload another batch
        </NuxtLink>
      </div>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading batch detail"
      description="Fetching the import summary, row errors, and source mapping results."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load batch"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Batch detail request failed.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="import-detail-grid">
        <article class="admin-card">
          <p class="admin-card__label">
            Source period
          </p>
          <p class="admin-card__value">
            {{ data.batch.sourcePeriod }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Uploaded at
          </p>
          <p class="admin-card__value">
            {{ formatDate(data.batch.uploadedAt) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Uploaded by
          </p>
          <p class="admin-card__value">
            {{ data.batch.uploadedBy }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Status
          </p>
          <p class="admin-card__value">
            <AppStatusBadge :status="data.batch.status" />
          </p>
        </article>
      </section>

      <section class="import-detail-grid">
        <article class="admin-card">
          <p class="admin-card__label">
            Total rows
          </p>
          <p class="admin-card__value">
            {{ data.batch.summary.total }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Accepted
          </p>
          <p class="admin-card__value">
            {{ data.batch.summary.accepted }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Rejected
          </p>
          <p class="admin-card__value">
            {{ data.batch.summary.rejected }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Duplicates
          </p>
          <p class="admin-card__value">
            {{ data.batch.summary.duplicates }}
          </p>
        </article>
      </section>

      <article class="vendor-panel stack-grid">
        <div>
          <h2>Batch metadata</h2>
          <p class="panel-copy">
            Checksum: <strong>{{ data.batch.checksum }}</strong>
          </p>
        </div>

        <div>
          <h2>Rejected rows</h2>

          <AppEmptyState
            v-if="data.batch.errors.length === 0"
            title="No row errors"
            description="This batch did not record any row-level validation issues."
          />

          <div
            v-else
            class="detail-list"
          >
            <article
              v-for="rowError in data.batch.errors"
              :key="`${rowError.code}-${rowError.rowNumber}-${rowError.reason}`"
              class="detail-list__row"
            >
              <span class="detail-list__eyebrow">
                {{ rowError.code }} • row {{ rowError.rowNumber }}
              </span>
              <p class="detail-list__title">
                {{ rowError.reason }}
              </p>
              <p class="detail-list__copy">
                {{ rowError.hint }}
              </p>
            </article>
          </div>
        </div>

        <div>
          <h2>Unmapped sources</h2>

          <AppEmptyState
            v-if="data.batch.unmappedSources.length === 0"
            title="No unmapped sources"
            description="Every source in this batch matched an approved vendor mapping."
          />

          <ul
            v-else
            class="compact-list"
          >
            <li
              v-for="source in data.batch.unmappedSources"
              :key="source"
            >
              {{ source }}
            </li>
          </ul>
        </div>
      </article>
    </template>
  </section>
</template>
