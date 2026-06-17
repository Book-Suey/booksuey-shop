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
  isLinked: boolean
  linkedVendorId: string | null
  totalSalesCount: number
  availableBalance: string
}

interface InviteVendorResponse {
  message: string
  invitePath: string
  inviteEmail?: {
    delivered: boolean
    skippedReason?: string
  }
  vendor: {
    vendorId: string
    approvedVendorId?: string
    email: string
  }
}

const auth = useAdminAuth()
const search = ref('')
const showCreateModal = ref(false)
const showEditModal = ref(false)
const showInviteModal = ref(false)
const isCreating = ref(false)
const isEditing = ref(false)
const isInviting = ref(false)
const createError = ref<string | null>(null)
const editError = ref<string | null>(null)
const inviteError = ref<string | null>(null)
const inviteSuccess = ref<InviteVendorResponse | null>(null)
const copyInviteMessage = ref<string | null>(null)
const inviteApprovedVendorId = ref('')
const editTargetId = ref<string | null>(null)

const createForm = reactive({
  basilId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
})

const editForm = reactive({
  basilId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
})

const { data, pending, error, refresh } = await useAsyncData(
  'admin-approved-vendors-list',
  async () => {
    return await $fetch<{ approvedVendors: ApprovedVendorRecord[] }>(
      '/api/admin/approved-vendors',
      {
        method: 'GET'
      }
    )
  },
  {
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
  { key: 'totalSalesCount', label: 'Total Sales' },
  { key: 'availableBalance', label: 'Available Balance' },
  { key: 'linked', label: 'Account Status' },
  { key: 'actions', label: 'Actions' }
]

function formatCurrency(amount: string): string {
  const parsed = Number.parseFloat(amount)

  if (Number.isNaN(parsed)) {
    return amount
  }

  return parsed.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  })
}

const inviteOptions = computed(() => {
  return data.value.approvedVendors
    .filter(approvedVendor => !approvedVendor.isLinked)
    .map(approvedVendor => ({
      value: approvedVendor.basilId,
      label: `${approvedVendor.lastName}, ${approvedVendor.firstName} (${approvedVendor.email})`
    }))
})

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

function openEditModal(row: ApprovedVendorRecord): void {
  editError.value = null
  editTargetId.value = row.basilId
  editForm.basilId = row.basilId
  editForm.firstName = row.firstName
  editForm.lastName = row.lastName
  editForm.email = row.email
  editForm.phone = row.phone || ''
  showEditModal.value = true
}

function closeEditModal(): void {
  if (isEditing.value) {
    return
  }

  showEditModal.value = false
}

function openInviteModal(approvedVendorId?: string): void {
  inviteError.value = null
  inviteSuccess.value = null
  copyInviteMessage.value = null

  if (
    approvedVendorId
    && inviteOptions.value.some(option => option.value === approvedVendorId)
  ) {
    inviteApprovedVendorId.value = approvedVendorId
  } else {
    inviteApprovedVendorId.value = inviteOptions.value[0]?.value || ''
  }

  showInviteModal.value = true
}

function closeInviteModal(): void {
  if (isInviting.value) {
    return
  }

  showInviteModal.value = false
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

async function submitApprovedVendorEdit(): Promise<void> {
  if (!editTargetId.value) {
    return
  }

  editError.value = null
  isEditing.value = true

  try {
    await auth.ensureInitialized()

    await $fetch(`/api/admin/approved-vendors/${editTargetId.value}`, {
      method: 'PATCH',
      headers: auth.authHeaders(),
      body: {
        basilId: editForm.basilId.trim(),
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        email: editForm.email.trim(),
        phone: editForm.phone.trim() || undefined
      }
    })

    showEditModal.value = false
    editTargetId.value = null
    await refresh()
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    editError.value
      = statusMessage || 'Unable to update approved vendor record.'
  } finally {
    isEditing.value = false
  }
}

async function submitVendorInvite(): Promise<void> {
  inviteError.value = null
  inviteSuccess.value = null
  copyInviteMessage.value = null

  if (!inviteApprovedVendorId.value) {
    inviteError.value = 'Select an approved vendor to invite.'
    return
  }

  isInviting.value = true

  try {
    await auth.ensureInitialized()

    inviteSuccess.value = await $fetch<InviteVendorResponse>(
      '/api/admin/vendors/invite',
      {
        method: 'POST',
        headers: auth.authHeaders(),
        body: {
          approvedVendorId: inviteApprovedVendorId.value
        }
      }
    )

    await refresh()
  } catch (requestError: unknown) {
    const statusMessage = (requestError as { statusMessage?: string })
      ?.statusMessage
    inviteError.value
      = statusMessage || 'Unable to send vendor invite right now.'
  } finally {
    isInviting.value = false
  }
}

async function copyInviteLink(): Promise<void> {
  if (!inviteSuccess.value || !import.meta.client) {
    return
  }

  const absoluteInviteLink = `${window.location.origin}${inviteSuccess.value.invitePath}`

  try {
    await navigator.clipboard.writeText(absoluteInviteLink)
    copyInviteMessage.value = 'Invite link copied to clipboard.'
  } catch {
    copyInviteMessage.value
      = 'Unable to copy link automatically. Copy it manually from the message above.'
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
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
        <template #cell:totalSalesCount="{ row }">
          {{ Number((row as ApprovedVendorRecord).totalSalesCount || 0) }}
        </template>
        <template #cell:availableBalance="{ row }">
          {{ formatCurrency((row as ApprovedVendorRecord).availableBalance || '0.00') }}
        </template>
        <template #cell:linked="{ row }">
          <div class="linked-status-cell">
            <AppStatusBadge
              :status="
                (row as ApprovedVendorRecord).isLinked ? 'active' : 'inactive'
              "
              :label="
                (row as ApprovedVendorRecord).isLinked ? 'Linked' : 'Not linked'
              "
            />
            <a
              v-if="!(row as ApprovedVendorRecord).isLinked"
              href="#"
              class="auth-inline-link"
              @click.prevent="
                openInviteModal((row as ApprovedVendorRecord).basilId)
              "
            >Invite User</a>
          </div>
        </template>
        <template #cell:actions="{ row }">
          <NuxtLink
            :to="`/admin/vendors/approved-vendors/${(row as ApprovedVendorRecord).basilId}`"
            class="auth-inline-link"
          >View</NuxtLink>
          <span> • </span>
          <a
            href="#"
            class="auth-inline-link"
            @click.prevent="openEditModal(row as ApprovedVendorRecord)"
          >Edit</a>
        </template>
      </AppDataTable>
    </article>

    <div
      v-if="showInviteModal"
      class="modal-backdrop"
      @click.self="closeInviteModal"
    >
      <article class="modal-panel">
        <div class="vendor-panel__title">
          <h2>Invite vendor</h2>
          <button
            type="button"
            class="portal-button portal-button--secondary"
            :disabled="isInviting"
            @click="closeInviteModal"
          >
            Close
          </button>
        </div>

        <p class="panel-copy">
          Choose an approved vendor record to send a login invite. This creates
          a linked vendor account when needed and prepares a password setup
          link.
        </p>

        <form
          class="auth-form"
          @submit.prevent="submitVendorInvite"
        >
          <label>
            <span>Approved vendor</span>
            <select
              v-model="inviteApprovedVendorId"
              :disabled="inviteOptions.length === 0"
            >
              <option
                v-if="inviteOptions.length === 0"
                value=""
              >
                No unlinked approved vendors available
              </option>
              <option
                v-for="option in inviteOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>

          <p
            v-if="inviteError"
            class="auth-error"
          >
            {{ inviteError }}
          </p>

          <p
            v-if="inviteSuccess"
            class="auth-success"
          >
            {{ inviteSuccess.message }} Invite link:
            {{ inviteSuccess.invitePath }}
            <template v-if="inviteSuccess.inviteEmail?.delivered">
              Email sent.
            </template>
            <template v-else-if="inviteSuccess.inviteEmail?.skippedReason">
              Email not sent: {{ inviteSuccess.inviteEmail.skippedReason }}.
            </template>
          </p>

          <p
            v-if="copyInviteMessage"
            class="panel-copy"
          >
            {{ copyInviteMessage }}
          </p>

          <div class="vendor-actions">
            <button
              type="submit"
              class="portal-button portal-button--primary"
              :disabled="isInviting || inviteOptions.length === 0"
            >
              {{ isInviting ? "Sending invite..." : "Send invite" }}
            </button>
            <button
              v-if="inviteSuccess"
              type="button"
              class="portal-button portal-button--secondary"
              @click="copyInviteLink"
            >
              Copy invite link
            </button>
          </div>
        </form>
      </article>
    </div>

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

    <div
      v-if="showEditModal"
      class="modal-backdrop"
      @click.self="closeEditModal"
    >
      <article class="modal-panel">
        <div class="vendor-panel__title">
          <h2>Edit approved vendor</h2>
          <button
            type="button"
            class="portal-button portal-button--secondary"
            :disabled="isEditing"
            @click="closeEditModal"
          >
            Close
          </button>
        </div>

        <form
          class="auth-form"
          @submit.prevent="submitApprovedVendorEdit"
        >
          <label>
            <span>Basil ID</span>
            <input
              v-model="editForm.basilId"
              required
              type="text"
            >
          </label>

          <label>
            <span>First name</span>
            <input
              v-model="editForm.firstName"
              required
              type="text"
            >
          </label>

          <label>
            <span>Last name</span>
            <input
              v-model="editForm.lastName"
              required
              type="text"
            >
          </label>

          <label>
            <span>Email</span>
            <input
              v-model="editForm.email"
              required
              type="email"
            >
          </label>

          <label>
            <span>Phone (optional)</span>
            <input
              v-model="editForm.phone"
              type="text"
            >
          </label>

          <p
            v-if="editError"
            class="auth-error"
          >
            {{ editError }}
          </p>

          <div class="vendor-actions">
            <button
              type="submit"
              class="portal-button portal-button--primary"
              :disabled="isEditing"
            >
              {{ isEditing ? "Saving..." : "Save changes" }}
            </button>
          </div>
        </form>
      </article>
    </div>
  </section>
</template>

<style scoped>
.linked-status-cell {
  display: grid;
  gap: 0.35rem;
}
</style>
