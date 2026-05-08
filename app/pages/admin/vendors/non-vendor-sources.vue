<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface NonVendorSourceRecord {
  sourceName: string
  normalizedSource: string
  createdAt: string
  updatedAt: string
}

const auth = useAdminAuth()
const search = ref('')
const showCreateModal = ref(false)
const showEditModal = ref(false)
const isCreating = ref(false)
const isEditing = ref(false)
const isDeleting = ref(false)
const createError = ref<string | null>(null)
const editError = ref<string | null>(null)
const deleteError = ref<string | null>(null)
const editTargetNormalizedSource = ref<string | null>(null)

const createForm = reactive({
  sourceName: ''
})

const editForm = reactive({
  sourceName: ''
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-non-vendor-sources-list',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ nonVendorSources: NonVendorSourceRecord[] }>(
      '/api/admin/non-vendor-sources',
      {
        method: 'GET',
        headers: auth.authHeaders()
      }
    )
  },
  {
    server: false,
    default: () => ({ nonVendorSources: [] as NonVendorSourceRecord[] })
  }
)

const filteredRows = computed(() => {
  const needle = search.value.trim().toLowerCase()

  if (!needle) {
    return data.value.nonVendorSources
  }

  return data.value.nonVendorSources.filter((source) => {
    return [source.sourceName, source.normalizedSource].some(value =>
      value.toLowerCase().includes(needle)
    )
  })
})

const columns = [
  { key: 'sourceName', label: 'Source Name' },
  { key: 'normalizedSource', label: 'Normalized' },
  { key: 'actions', label: 'Actions' }
]

function openCreateModal(): void {
  createError.value = null
  showCreateModal.value = true
}

function closeCreateModal(): void {
  if (isCreating.value) {
    return
  }

  showCreateModal.value = false
}

function openEditModal(row: NonVendorSourceRecord): void {
  editError.value = null
  deleteError.value = null
  editTargetNormalizedSource.value = row.normalizedSource
  editForm.sourceName = row.sourceName
  showEditModal.value = true
}

function closeEditModal(): void {
  if (isEditing.value || isDeleting.value) {
    return
  }

  showEditModal.value = false
}

async function submitNewNonVendorSource(): Promise<void> {
  createError.value = null
  isCreating.value = true

  try {
    await auth.ensureInitialized()

    await $fetch('/api/admin/non-vendor-sources', {
      method: 'POST',
      headers: auth.authHeaders(),
      body: {
        sourceName: createForm.sourceName.trim()
      }
    })

    createForm.sourceName = ''
    showCreateModal.value = false
    await refresh()
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    createError.value
      = statusMessage || 'Unable to create verified non-vendor source.'
  } finally {
    isCreating.value = false
  }
}

async function submitNonVendorSourceEdit(): Promise<void> {
  if (!editTargetNormalizedSource.value) {
    return
  }

  editError.value = null
  isEditing.value = true

  try {
    await auth.ensureInitialized()

    await $fetch(
      `/api/admin/non-vendor-sources/${encodeURIComponent(editTargetNormalizedSource.value)}`,
      {
        method: 'PATCH',
        headers: auth.authHeaders(),
        body: {
          sourceName: editForm.sourceName.trim()
        }
      }
    )

    showEditModal.value = false
    editTargetNormalizedSource.value = null
    await refresh()
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    editError.value
      = statusMessage || 'Unable to update verified non-vendor source.'
  } finally {
    isEditing.value = false
  }
}

async function deleteNonVendorSource(): Promise<void> {
  if (!editTargetNormalizedSource.value) {
    return
  }

  deleteError.value = null
  isDeleting.value = true

  try {
    await auth.ensureInitialized()

    await $fetch(
      `/api/admin/non-vendor-sources/${encodeURIComponent(editTargetNormalizedSource.value)}`,
      {
        method: 'DELETE',
        headers: auth.authHeaders()
      }
    )

    showEditModal.value = false
    editTargetNormalizedSource.value = null
    await refresh()
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    deleteError.value
      = statusMessage || 'Unable to delete verified non-vendor source.'
  } finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">
        Admin vendor management
      </p>
      <h1 class="auth-title">
        Verified non-vendor sources
      </h1>
      <p class="auth-copy">
        Maintain source names that should be rejected from vendor sales imports
        without being treated as import errors.
      </p>
      <div class="vendor-actions">
        <button
          type="button"
          class="portal-button portal-button--primary"
          @click="openCreateModal"
        >
          Add non-vendor source
        </button>
      </div>
    </header>

    <article class="vendor-panel">
      <form class="auth-form">
        <label>
          <span>Search</span>
          <input
            v-model="search"
            type="text"
            placeholder="Search by source name"
          >
        </label>
      </form>
    </article>

    <AppLoadingState
      v-if="pending"
      title="Loading non-vendor sources"
      description="Fetching verified non-vendor source records."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load non-vendor sources"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="filteredRows.length === 0"
      title="No non-vendor sources found"
      description="Create a new record or adjust your search."
    />

    <article
      v-else
      class="vendor-panel"
    >
      <AppDataTable
        :columns="columns"
        :rows="filteredRows"
        :row-key="(row) => row.normalizedSource"
      >
        <template #cell:actions="{ row }">
          <a
            href="#"
            class="auth-inline-link"
            @click.prevent="openEditModal(row as NonVendorSourceRecord)"
          >
            Edit
          </a>
        </template>
      </AppDataTable>
    </article>

    <div
      v-if="showCreateModal"
      class="modal-backdrop"
      @click.self="closeCreateModal"
    >
      <article class="modal-panel">
        <div class="vendor-panel__title">
          <h2>Add verified non-vendor source</h2>
          <button
            type="button"
            class="portal-button portal-button--secondary"
            :disabled="isCreating"
            @click="closeCreateModal"
          >
            Close
          </button>
        </div>

        <form
          class="auth-form"
          @submit.prevent="submitNewNonVendorSource"
        >
          <label>
            <span>Source name</span>
            <input
              v-model="createForm.sourceName"
              required
              type="text"
            >
          </label>

          <p
            v-if="createError"
            class="auth-error"
          >
            {{ createError }}
          </p>

          <div class="vendor-actions">
            <button
              type="submit"
              class="portal-button portal-button--primary"
              :disabled="isCreating"
            >
              {{ isCreating ? "Creating..." : "Create source" }}
            </button>
          </div>
        </form>
      </article>
    </div>

    <div
      v-if="showEditModal"
      class="modal-backdrop"
      @click.self="closeEditModal"
    >
      <article class="modal-panel">
        <div class="vendor-panel__title">
          <h2>Edit verified non-vendor source</h2>
          <button
            type="button"
            class="portal-button portal-button--secondary"
            :disabled="isEditing || isDeleting"
            @click="closeEditModal"
          >
            Close
          </button>
        </div>

        <form
          class="auth-form"
          @submit.prevent="submitNonVendorSourceEdit"
        >
          <label>
            <span>Source name</span>
            <input
              v-model="editForm.sourceName"
              required
              type="text"
            >
          </label>

          <p
            v-if="editError"
            class="auth-error"
          >
            {{ editError }}
          </p>

          <p
            v-if="deleteError"
            class="auth-error"
          >
            {{ deleteError }}
          </p>

          <div class="vendor-actions">
            <button
              type="submit"
              class="portal-button portal-button--primary"
              :disabled="isEditing || isDeleting"
            >
              {{ isEditing ? "Saving..." : "Save changes" }}
            </button>
            <button
              type="button"
              class="portal-button portal-button--secondary"
              :disabled="isEditing || isDeleting"
              @click="deleteNonVendorSource"
            >
              {{ isDeleting ? "Deleting..." : "Delete source" }}
            </button>
          </div>
        </form>
      </article>
    </div>
  </section>
</template>
