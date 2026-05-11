<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface AdminImportError {
  code: string
  rowNumber: number
  reason: string
  hint: string
}

interface AdminImportRecord {
  batchId: string
  sourcePeriod: string
  uploadedBy: string
  uploadedAt: string
  status: 'completed' | 'failed'
  summary: {
    total: number
    accepted: number
    rejected: number
    nonVendorRejected: number
    duplicates: number
  }
  errors: AdminImportError[]
  unmappedSources: string[]
}

interface ImportUploadResponse {
  batchId: string
  summary: {
    total: number
    accepted: number
    rejected: number
    nonVendorRejected: number
    duplicates: number
  }
}

const auth = useAdminAuth()
const showUploadModal = ref(false)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const uploadSuccess = ref<ImportUploadResponse | null>(null)
const selectedFileName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const filters = reactive({
  status: 'all',
  sourcePeriod: '',
  dateFrom: '',
  dateTo: ''
})

const uploadForm = reactive({
  sourcePeriod: '',
  file: null as File | null
})

const columns = [
  { key: 'uploadedAt', label: 'Uploaded' },
  { key: 'sourcePeriod', label: 'Source Period' },
  { key: 'status', label: 'Status' },
  { key: 'summary', label: 'Summary' },
  { key: 'uploadedBy', label: 'Uploaded By' },
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

function toBatchDetailPath(batchId: string): string {
  return `/admin/imports/${encodeURIComponent(batchId)}`
}

const { data, pending, error, refresh } = await useAsyncData(
  'admin-imports-list',
  async () => {
    await auth.ensureInitialized()

    const query: Record<string, string | number> = {
      limit: 100
    }

    if (filters.status !== 'all') {
      query.status = filters.status
    }

    if (filters.sourcePeriod.trim()) {
      query.sourcePeriod = filters.sourcePeriod.trim()
    }

    const dateFrom = toIsoBoundary(filters.dateFrom, 'start')
    const dateTo = toIsoBoundary(filters.dateTo, 'end')

    if (dateFrom) {
      query.dateFrom = dateFrom
    }

    if (dateTo) {
      query.dateTo = dateTo
    }

    return await $fetch<{ imports: AdminImportRecord[] }>(
      '/api/admin/imports',
      {
        method: 'GET',
        headers: auth.authHeaders(),
        query
      }
    )
  },
  {
    server: false,
    watch: [
      () => filters.status,
      () => filters.sourcePeriod,
      () => filters.dateFrom,
      () => filters.dateTo
    ],
    default: () => ({ imports: [] as AdminImportRecord[] })
  }
)

const metrics = computed(() => {
  const imports = data.value.imports

  return {
    total: imports.length,
    flagged: imports.filter(batch => batch.summary.rejected > 0).length,
    failed: imports.filter(batch => batch.status === 'failed').length,
    rows: imports.reduce((sum, batch) => sum + batch.summary.total, 0)
  }
})

function openUploadModal(): void {
  uploadError.value = null
  uploadSuccess.value = null
  showUploadModal.value = true
}

function closeUploadModal(): void {
  if (isUploading.value) {
    return
  }

  showUploadModal.value = false
}

function updateFileSelection(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  uploadForm.file = file
  selectedFileName.value = file?.name ?? ''
}

async function submitSalesDetailUpload(): Promise<void> {
  uploadError.value = null
  uploadSuccess.value = null

  if (!uploadForm.sourcePeriod.trim()) {
    uploadError.value = 'Enter the source period for this report.'
    return
  }

  if (!uploadForm.file) {
    uploadError.value = 'Select a CSV report to upload.'
    return
  }

  isUploading.value = true

  try {
    await auth.ensureInitialized()

    const payload = new FormData()
    payload.append('sourcePeriod', uploadForm.sourcePeriod.trim())
    payload.append('file', uploadForm.file)

    uploadSuccess.value = await $fetch<ImportUploadResponse>(
      '/api/admin/sales/imports',
      {
        method: 'POST',
        headers: auth.authHeaders(),
        body: payload
      }
    )

    uploadForm.sourcePeriod = ''
    uploadForm.file = null
    selectedFileName.value = ''

    if (fileInput.value) {
      fileInput.value.value = ''
    }

    await refresh()
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    uploadError.value
      = statusMessage || 'Unable to upload this sales detail report right now.'
  } finally {
    isUploading.value = false
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">
        Import history
      </h1>
      <p class="auth-copy">
        Filter import runs by status, period, and upload date to review batch
        health.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/audit?entityType=SalesImportBatch"
          class="portal-button portal-button--secondary"
        >
          View import audit trail
        </NuxtLink>
        <button
          type="button"
          class="portal-button portal-button--primary"
          @click="openUploadModal"
        >
          Upload Sales Detail Report
        </button>
      </div>
    </header>

    <section class="admin-cards">
      <article class="admin-card">
        <p class="admin-card__label">
          Batches in view
        </p>
        <p class="admin-card__value">
          {{ metrics.total }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">
          Flagged batches
        </p>
        <p class="admin-card__value">
          {{ metrics.flagged }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">
          Failed batches
        </p>
        <p class="admin-card__value">
          {{ metrics.failed }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">
          Rows in view
        </p>
        <p class="admin-card__value">
          {{ metrics.rows }}
        </p>
      </article>
    </section>

    <article class="vendor-panel">
      <h2>Filters</h2>

      <form class="auth-form filter-grid">
        <label>
          <span>Status</span>
          <select v-model="filters.status">
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </label>

        <label>
          <span>Source period</span>
          <input
            v-model="filters.sourcePeriod"
            type="text"
            placeholder="2026-Q2"
          >
        </label>

        <label>
          <span>Uploaded from</span>
          <input
            v-model="filters.dateFrom"
            type="date"
          >
        </label>

        <label>
          <span>Uploaded to</span>
          <input
            v-model="filters.dateTo"
            type="date"
          >
        </label>
      </form>
    </article>

    <AppLoadingState
      v-if="pending"
      title="Loading imports"
      description="Fetching import history with the current filters."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load imports"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Import history request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="data.imports.length === 0"
      title="No import batches found"
      description="Adjust the filters or upload a new sales batch to get started."
    />

    <article
      v-else
      class="vendor-panel"
    >
      <h2>Batch history</h2>

      <AppDataTable
        :columns="columns"
        :rows="data.imports"
        :row-key="(row) => row.batchId"
        :mobile-columns="[
          'uploadedAt',
          'status',
          'sourcePeriod',
          'summary',
          'actions'
        ]"
      >
        <template #cell:uploadedAt="{ row }">
          {{ formatDate(row.uploadedAt as string) }}
        </template>
        <template #cell:status="{ row }">
          <AppStatusBadge :status="row.status as string" />
        </template>
        <template #cell:summary="{ row }">
          {{ row.summary.accepted as number }} accepted /
          {{ row.summary.rejected as number }} rejected /
          {{ row.summary.nonVendorRejected as number }} non-vendor /
          {{ row.summary.duplicates as number }} duplicate
        </template>
        <template #cell:actions="{ row }">
          <a :href="toBatchDetailPath(row.batchId as string)"> Review batch </a>
        </template>
      </AppDataTable>
    </article>

    <div
      v-if="showUploadModal"
      class="modal-backdrop"
      @click.self="closeUploadModal"
    >
      <article class="modal-panel">
        <div class="vendor-panel__title">
          <h2>Upload Sales Detail Report</h2>
          <button
            type="button"
            class="portal-button portal-button--secondary"
            :disabled="isUploading"
            @click="closeUploadModal"
          >
            Close
          </button>
        </div>

        <p class="panel-copy">
          Select a CSV report from your computer and label it with the source
          period for reconciliation.
        </p>

        <form
          class="auth-form"
          @submit.prevent="submitSalesDetailUpload"
        >
          <label>
            <span>Source period</span>
            <input
              v-model="uploadForm.sourcePeriod"
              type="text"
              placeholder="2026-Q2"
              required
            >
          </label>

          <label>
            <span>CSV file</span>
            <input
              ref="fileInput"
              type="file"
              accept=".csv,text/csv"
              required
              @change="updateFileSelection"
            >
          </label>

          <p
            v-if="selectedFileName"
            class="panel-copy"
          >
            Selected file: <strong>{{ selectedFileName }}</strong>
          </p>

          <p
            v-if="uploadError"
            class="auth-error"
          >
            {{ uploadError }}
          </p>

          <p
            v-if="uploadSuccess"
            class="auth-success"
          >
            Report uploaded.
            <a :href="toBatchDetailPath(uploadSuccess.batchId)">Review batch</a>
          </p>

          <div class="vendor-actions">
            <button
              type="submit"
              class="portal-button portal-button--primary"
              :disabled="isUploading"
            >
              {{ isUploading ? "Uploading..." : "Upload report" }}
            </button>
          </div>
        </form>
      </article>
    </div>
  </section>
</template>
