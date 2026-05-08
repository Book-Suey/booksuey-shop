<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface ImportResponse {
  batchId: string
  summary: {
    total: number
    accepted: number
    rejected: number
    duplicates: number
  }
  errors: Array<{
    code: string
    rowNumber: number
    reason: string
    hint: string
  }>
  unmappedSources: string[]
}

const auth = useAdminAuth()
const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const uploadedBatch = ref<ImportResponse | null>(null)
const selectedFileName = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const form = reactive({
  sourcePeriod: '',
  file: null as File | null
})

function toBatchDetailPath(batchId: string): string {
  return `/admin/imports/${encodeURIComponent(batchId)}`
}

function updateFileSelection(event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  form.file = file
  selectedFileName.value = file?.name ?? ''
}

async function submitImport(): Promise<void> {
  submitError.value = null
  uploadedBatch.value = null

  if (!form.sourcePeriod.trim()) {
    submitError.value = 'Enter the source period for this import.'
    return
  }

  if (!form.file) {
    submitError.value = 'Select a CSV file to upload.'
    return
  }

  isSubmitting.value = true

  try {
    await auth.ensureInitialized()

    const payload = new FormData()
    payload.append('sourcePeriod', form.sourcePeriod.trim())
    payload.append('file', form.file)

    uploadedBatch.value = await $fetch<ImportResponse>(
      '/api/admin/sales/imports',
      {
        method: 'POST',
        headers: auth.authHeaders(),
        body: payload
      }
    )

    form.sourcePeriod = ''
    form.file = null
    selectedFileName.value = ''

    if (fileInput.value) {
      fileInput.value.value = ''
    }
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage
    submitError.value
      = statusMessage || 'Unable to import this CSV batch right now.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">
        Admin sales imports
      </p>
      <h1 class="auth-title">
        Upload sales CSV
      </h1>
      <p class="auth-copy">
        Import a source batch, generate ledger entries, and surface unmapped or
        rejected rows immediately.
      </p>
    </header>

    <article class="vendor-panel stack-grid">
      <div>
        <h2>New import batch</h2>
        <p class="panel-copy">
          Upload the raw CSV export and label it with the source period used for
          downstream reconciliation.
        </p>
      </div>

      <form
        class="auth-form"
        @submit.prevent="submitImport"
      >
        <label>
          <span>Source period</span>
          <input
            v-model="form.sourcePeriod"
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
          v-if="submitError"
          class="auth-error"
        >
          {{ submitError }}
        </p>

        <button
          type="submit"
          class="portal-button portal-button--primary"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? "Importing batch..." : "Upload and import" }}
        </button>
      </form>
    </article>

    <article
      v-if="uploadedBatch"
      class="vendor-panel stack-grid"
    >
      <div class="vendor-panel__title">
        <h2>Import summary</h2>
        <a :href="toBatchDetailPath(uploadedBatch.batchId)">
          Open batch detail
        </a>
      </div>

      <section class="import-detail-grid">
        <article class="admin-card">
          <p class="admin-card__label">
            Total rows
          </p>
          <p class="admin-card__value">
            {{ uploadedBatch.summary.total }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Accepted
          </p>
          <p class="admin-card__value">
            {{ uploadedBatch.summary.accepted }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Rejected
          </p>
          <p class="admin-card__value">
            {{ uploadedBatch.summary.rejected }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Duplicates
          </p>
          <p class="admin-card__value">
            {{ uploadedBatch.summary.duplicates }}
          </p>
        </article>
      </section>

      <AppEmptyState
        v-if="
          uploadedBatch.errors.length === 0
            && uploadedBatch.unmappedSources.length === 0
        "
        title="Batch imported cleanly"
        description="No row-level validation problems or unmapped sources were detected."
      />

      <template v-else>
        <div>
          <h2>Rejected rows</h2>

          <AppEmptyState
            v-if="uploadedBatch.errors.length === 0"
            title="No rejected rows"
            description="Every parsed row was either accepted or marked duplicate."
          />

          <div
            v-else
            class="detail-list"
          >
            <article
              v-for="rowError in uploadedBatch.errors"
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
            v-if="uploadedBatch.unmappedSources.length === 0"
            title="No unmapped sources"
            description="Every source row resolved to an approved vendor mapping."
          />

          <ul
            v-else
            class="compact-list"
          >
            <li
              v-for="source in uploadedBatch.unmappedSources"
              :key="source"
            >
              {{ source }}
            </li>
          </ul>
        </div>
      </template>
    </article>
  </section>
</template>
