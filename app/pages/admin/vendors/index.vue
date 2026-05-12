<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface VendorRecord {
  vendorId: string
  legalName: string
  displayName: string
  email: string
  phone?: string
  status: 'active' | 'inactive'
  approvedVendorId?: string
  totalSalesCount: number
  currentBalance: string
}

interface ApprovedVendorRecord {
  basilId: string
  firstName: string
  lastName: string
  email: string
  phone?: string
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
const statusFilter = ref<'all' | 'active' | 'inactive'>('all')
const showInviteModal = ref(false)
const inviteApprovedVendorId = ref('')
const inviteError = ref<string | null>(null)
const inviteSuccess = ref<InviteVendorResponse | null>(null)
const isInviting = ref(false)
const copyInviteMessage = ref<string | null>(null)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-vendors-list',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ vendors: VendorRecord[] }>('/api/admin/vendors', {
      method: 'GET',
      headers: auth.authHeaders(),
      query:
        statusFilter.value === 'all'
          ? undefined
          : { status: statusFilter.value }
    })
  },
  {
    server: false,
    watch: [statusFilter],
    default: () => ({ vendors: [] as VendorRecord[] })
  }
)

const { data: approvedVendorData, pending: approvedVendorsPending }
  = await useAsyncData(
    'admin-approved-vendors-for-invite',
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

const inviteOptions = computed(() => {
  const linkedApprovedVendorIds = new Set(
    data.value.vendors
      .map(vendor => vendor.approvedVendorId)
      .filter((value): value is string => Boolean(value))
  )

  return approvedVendorData.value.approvedVendors
    .filter(
      approvedVendor => !linkedApprovedVendorIds.has(approvedVendor.basilId)
    )
    .map(approvedVendor => ({
      value: approvedVendor.basilId,
      label: `${approvedVendor.lastName}, ${approvedVendor.firstName} (${approvedVendor.email})`
    }))
})

const columns = [
  { key: 'displayName', label: 'Display Name' },
  { key: 'email', label: 'Email' },
  { key: 'totalSalesCount', label: 'Total Sales' },
  { key: 'currentBalance', label: 'Current Balance' },
  { key: 'status', label: 'Status' },
  { key: 'approvedVendorId', label: 'Approved Vendor' },
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

function openInviteModal(): void {
  inviteError.value = null
  inviteSuccess.value = null
  copyInviteMessage.value = null
  inviteApprovedVendorId.value = inviteOptions.value[0]?.value || ''
  showInviteModal.value = true
}

function closeInviteModal(): void {
  if (isInviting.value) {
    return
  }

  showInviteModal.value = false
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
        Vendor accounts
      </h1>
      <p class="auth-copy">
        Review vendor account status, linked approved vendors, and send invites.
      </p>
      <div class="vendor-actions">
        <button
          type="button"
          class="portal-button portal-button--primary"
          @click="openInviteModal"
        >
          Invite vendor
        </button>
      </div>
    </header>

    <article class="vendor-panel">
      <form class="auth-form">
        <label>
          <span>Status filter</span>
          <select v-model="statusFilter">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </form>
    </article>

    <AppLoadingState
      v-if="pending"
      title="Loading vendors"
      description="Fetching vendor account records."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load vendors"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="data.vendors.length === 0"
      title="No vendors found"
      description="Create a vendor account or adjust your status filter."
    />

    <article
      v-else
      class="vendor-panel"
    >
      <AppDataTable
        :columns="columns"
        :rows="data.vendors"
        :row-key="(row) => row.vendorId"
        :mobile-columns="[
          'displayName',
          'totalSalesCount',
          'currentBalance',
          'status',
          'approvedVendorId',
          'email',
          'actions'
        ]"
      >
        <template #cell:totalSalesCount="{ row }">
          {{ Number(row.totalSalesCount as number) }}
        </template>
        <template #cell:currentBalance="{ row }">
          {{ formatCurrency(row.currentBalance as string) }}
        </template>
        <template #cell:status="{ row }">
          <AppStatusBadge :status="row.status as string" />
        </template>
        <template #cell:approvedVendorId="{ row }">
          {{ (row.approvedVendorId as string) || "—" }}
        </template>
        <template #cell:actions="{ row }">
          <NuxtLink :to="`/admin/vendors/${row.vendorId as string}`">
            View Details
          </NuxtLink>
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
              :disabled="approvedVendorsPending || inviteOptions.length === 0"
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
  </section>
</template>
