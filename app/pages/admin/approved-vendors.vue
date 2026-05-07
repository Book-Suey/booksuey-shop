<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface ApprovedVendorRecord {
  basilId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
}

const auth = useAdminAuth()
const search = ref('')
const showCreateModal = ref(false)
const isCreating = ref(false)
const createError = ref<string | null>(null)

const createForm = reactive({
  basilId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-approved-vendors-list',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ approvedVendors: ApprovedVendorRecord[] }>(
      '/api/admin/approved-vendors',
      {
        method: 'GET',
        headers: auth.authHeaders()
      }
    )
  },
  {
    server: false,
    default: () => ({ approvedVendors: [] as ApprovedVendorRecord[] })
  }
)

const filteredRows = computed(() => {
  const needle = search.value.trim().toLowerCase()

  if (!needle) {
    return data.value.approvedVendors
  }

  return data.value.approvedVendors.filter((vendor) => {
    return [
      vendor.basilId,
      vendor.firstName,
      vendor.lastName,
      vendor.email,
      vendor.phone || ''
    ].some(value => value.toLowerCase().includes(needle))
  })
})

const columns = [
  { key: 'basilId', label: 'Basil ID' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
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

async function submitNewApprovedVendor(): Promise<void> {
  createError.value = null
  isCreating.value = true

  try {
    await auth.ensureInitialized()

    await $fetch('/api/admin/approved-vendors', {
      method: 'POST',
      headers: auth.authHeaders(),
      body: {
        basilId: createForm.basilId.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim() || undefined
      }
    })

    createForm.basilId = ''
    createForm.firstName = ''
    createForm.lastName = ''
    createForm.email = ''
    createForm.phone = ''
    showCreateModal.value = false

    await refresh()
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    createError.value
      = statusMessage || 'Unable to create approved vendor record.'
  } finally {
    isCreating.value = false
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
        Approved vendor mapping
      </h1>
      <p class="auth-copy">
        Manage approved source records used to map imported sales to vendor
        accounts.
      </p>
      <div class="vendor-actions">
        <button
          type="button"
          class="portal-button portal-button--primary"
          @click="openCreateModal"
        >
          Add approved vendor
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
            placeholder="Search by basil ID, name, email, or phone"
          >
        </label>
      </form>
    </article>

    <AppLoadingState
      v-if="pending"
      title="Loading approved vendors"
      description="Fetching approved vendor records."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load approved vendors"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="filteredRows.length === 0"
      title="No approved vendors found"
      description="Create a new approved vendor record or adjust your search."
    />

    <article
      v-else
      class="vendor-panel"
    >
      <AppDataTable
        :columns="columns"
        :rows="filteredRows"
        :row-key="(row) => row.basilId"
      >
        <template #cell:name="{ row }">
          {{ row.lastName as string }}, {{ row.firstName as string }}
        </template>
        <template #cell:phone="{ row }">
          {{ (row.phone as string) || "—" }}
        </template>
        <template #cell:actions="{ row }">
          <NuxtLink :to="`/admin/approved-vendors/${row.basilId as string}`">
            Edit
          </NuxtLink>
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
          <h2>Add approved vendor</h2>
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
          @submit.prevent="submitNewApprovedVendor"
        >
          <label>
            <span>Basil ID</span>
            <input
              v-model="createForm.basilId"
              required
              type="text"
            >
          </label>

          <label>
            <span>First name</span>
            <input
              v-model="createForm.firstName"
              required
              type="text"
            >
          </label>

          <label>
            <span>Last name</span>
            <input
              v-model="createForm.lastName"
              required
              type="text"
            >
          </label>

          <label>
            <span>Email</span>
            <input
              v-model="createForm.email"
              required
              type="email"
            >
          </label>

          <label>
            <span>Phone (optional)</span>
            <input
              v-model="createForm.phone"
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
              {{ isCreating ? "Creating..." : "Create approved vendor" }}
            </button>
          </div>
        </form>
      </article>
    </div>
  </section>
</template>
