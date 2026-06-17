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

interface LinkedVendorRecord {
  vendorId: string
  legalName: string
  displayName: string
  email: string
  phone?: string
  status: 'active' | 'inactive'
  preferredPayoutMethod?: 'paypal' | 'venmo'
  approvedVendorId?: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

interface LinkedVendorBalance {
  pendingAmount: string
  availableAmount: string
  paidAmount: string
  asOf: string
}

interface ImportedSaleRecord {
  saleRecordId: string
  vendorId: string | null
  soldAt: string
  title: string
  grossAmount: string
  commissionAmount: string
  period: string
  saleOrderId: string
  currency: string
}

interface ApprovedVendorDetailResponse {
  approvedVendor: ApprovedVendorRecord
  linkedVendor: LinkedVendorRecord | null
  linkedBalance: LinkedVendorBalance
  importedSales: ImportedSaleRecord[]
  salesSummary: {
    count: number
    totalGross: string
    totalCommission: string
    latestSoldAt: string | null
  }
}

const route = useRoute()
const auth = useAdminAuth()
const isSubmitting = ref(false)
const isDeleting = ref(false)
const isEditMode = ref(false)
const formError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const approvedVendorId = computed(() =>
  String(route.params.approvedVendorId || '')
)

const { data, pending, error, refresh } = await useAsyncData(
  'admin-approved-vendor-detail',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<ApprovedVendorDetailResponse>(
      `/api/admin/approved-vendors/${approvedVendorId.value}`,
      {
        method: 'GET'
      }
    )
  },
  {
    watch: [approvedVendorId],
    default: () => ({
      approvedVendor: {
        basilId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
      },
      linkedVendor: null,
      linkedBalance: {
        pendingAmount: '0.00',
        availableAmount: '0.00',
        paidAmount: '0.00',
        asOf: new Date().toISOString()
      },
      importedSales: [] as ImportedSaleRecord[],
      salesSummary: {
        count: 0,
        totalGross: '0.00',
        totalCommission: '0.00',
        latestSoldAt: null
      }
    })
  }
)

const salesColumns = [
  { key: 'period', label: 'Period' },
  { key: 'soldAt', label: 'Sold At' },
  { key: 'title', label: 'Title' },
  { key: 'grossAmount', label: 'Gross' },
  { key: 'commissionAmount', label: 'Commission' }
]

const approvedVendorDisplayName = computed(() => {
  const firstName = data.value.approvedVendor.firstName.trim()
  const lastName = data.value.approvedVendor.lastName.trim()
  const fullName = [firstName, lastName].filter(Boolean).join(' ')

  return fullName || 'Vendor Name'
})

function formatCurrency(amount: string, currency = 'USD'): string {
  const parsed = Number.parseFloat(amount)

  if (Number.isNaN(parsed)) {
    return amount
  }

  return parsed.toLocaleString('en-US', {
    style: 'currency',
    currency
  })
}

function formatDate(value?: string | null): string {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return '—'
  }

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

const form = reactive({
  basilId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
})

watch(
  data,
  (next) => {
    if (!next) {
      return
    }

    form.basilId = next.approvedVendor.basilId
    form.firstName = next.approvedVendor.firstName
    form.lastName = next.approvedVendor.lastName
    form.email = next.approvedVendor.email
    form.phone = next.approvedVendor.phone || ''
  },
  { immediate: true }
)

async function submitUpdate(): Promise<void> {
  formError.value = null
  successMessage.value = null
  isSubmitting.value = true

  try {
    await auth.ensureInitialized()

    const response = await $fetch<{
      message: string
      approvedVendor: ApprovedVendorRecord
    }>(`/api/admin/approved-vendors/${approvedVendorId.value}`, {
      method: 'PATCH',
      headers: auth.authHeaders(),
      body: {
        basilId: form.basilId,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined
      }
    })

    successMessage.value = response.message
    if (response.approvedVendor.basilId !== approvedVendorId.value) {
      await navigateTo(
        `/admin/vendors/approved-vendors/${response.approvedVendor.basilId}`
      )
      return
    }

    await refresh()
  } catch (submitError: unknown) {
    const statusMessage = (submitError as { statusMessage?: string })
      ?.statusMessage
    formError.value = statusMessage || 'Unable to update approved vendor.'
  } finally {
    isSubmitting.value = false
  }
}

async function deleteRecord(): Promise<void> {
  if (!window.confirm('Delete this approved vendor record?')) {
    return
  }

  formError.value = null
  successMessage.value = null
  isDeleting.value = true

  try {
    await auth.ensureInitialized()

    await $fetch(`/api/admin/approved-vendors/${approvedVendorId.value}`, {
      method: 'DELETE',
      headers: auth.authHeaders()
    })

    await navigateTo('/admin/vendors/approved-vendors')
  } catch (deleteError: unknown) {
    const statusMessage = (deleteError as { statusMessage?: string })
      ?.statusMessage
    formError.value = statusMessage || 'Unable to delete approved vendor.'
  } finally {
    isDeleting.value = false
  }
}

function startEditing(): void {
  formError.value = null
  successMessage.value = null
  isEditMode.value = true
}

function cancelEditing(): void {
  formError.value = null
  successMessage.value = null
  isEditMode.value = false

  form.basilId = data.value.approvedVendor.basilId
  form.firstName = data.value.approvedVendor.firstName
  form.lastName = data.value.approvedVendor.lastName
  form.email = data.value.approvedVendor.email
  form.phone = data.value.approvedVendor.phone || ''
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">
        Approved Vendor - {{ approvedVendorDisplayName }}
      </h1>
      <p class="auth-copy">
        Basil ID: {{ data?.approvedVendor.basilId || "—" }} | Email:
        {{ data?.approvedVendor.email || "—" }} | Phone:
        {{ data?.approvedVendor.phone || "—" }}
      </p>
      <div
        v-if="!pending && !error"
        class="vendor-actions"
      >
        <button
          v-if="!isEditMode"
          type="button"
          class="portal-button portal-button--primary"
          @click="startEditing"
        >
          Edit approved vendor
        </button>
        <button
          v-else
          type="button"
          class="portal-button portal-button--secondary"
          @click="cancelEditing"
        >
          Cancel edit
        </button>
      </div>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading approved vendor"
      description="Fetching approved vendor details."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load approved vendor"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Request failed.'
      "
      @retry="refresh"
    />

    <article
      v-else
      class="vendor-panel"
    >
      <section class="admin-cards approved-vendor-summary-grid">
        <article class="admin-card">
          <p class="admin-card__label">
            Linked account
          </p>
          <template v-if="data.linkedVendor">
            <p class="panel-copy">
              <strong>{{ data.linkedVendor.displayName }}</strong>
            </p>
            <AppStatusBadge :status="data.linkedVendor.status" />
          </template>
          <p
            v-else
            class="panel-copy"
          >
            No linked vendor account
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Linked account email
          </p>
          <p class="panel-copy">
            {{ data.linkedVendor?.email || "—" }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Last login
          </p>
          <p class="panel-copy">
            {{ formatDateTime(data.linkedVendor?.lastLoginAt) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Imported sales
          </p>
          <p class="admin-card__value admin-card__value--compact">
            {{ data.salesSummary.count }}
          </p>
          <p class="panel-copy">
            Latest: {{ formatDate(data.salesSummary.latestSoldAt) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Imported gross
          </p>
          <p class="admin-card__value admin-card__value--compact">
            {{ formatCurrency(data.salesSummary.totalGross) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Imported commission
          </p>
          <p class="admin-card__value admin-card__value--compact">
            {{ formatCurrency(data.salesSummary.totalCommission) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Available balance
          </p>
          <p class="admin-card__value admin-card__value--compact">
            {{ formatCurrency(data.linkedBalance.availableAmount) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">
            Pending balance
          </p>
          <p class="admin-card__value admin-card__value--compact">
            {{ formatCurrency(data.linkedBalance.pendingAmount) }}
          </p>
        </article>
      </section>

      <form
        v-if="isEditMode"
        class="auth-form"
        @submit.prevent="submitUpdate"
      >
        <label>
          <span>Basil ID</span>
          <input
            v-model="form.basilId"
            required
            type="text"
          >
        </label>

        <label>
          <span>First name</span>
          <input
            v-model="form.firstName"
            required
            type="text"
          >
        </label>

        <label>
          <span>Last name</span>
          <input
            v-model="form.lastName"
            required
            type="text"
          >
        </label>

        <label>
          <span>Email</span>
          <input
            v-model="form.email"
            required
            type="email"
          >
        </label>

        <label>
          <span>Phone (optional)</span>
          <input
            v-model="form.phone"
            type="text"
          >
        </label>

        <p
          v-if="formError"
          class="auth-error"
        >
          {{ formError }}
        </p>

        <p
          v-if="successMessage"
          class="auth-success"
        >
          {{ successMessage }}
        </p>

        <div class="vendor-actions">
          <button
            type="submit"
            class="portal-button portal-button--primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "Saving..." : "Save changes" }}
          </button>
          <button
            type="button"
            class="portal-button portal-button--secondary"
            :disabled="isDeleting"
            @click="deleteRecord"
          >
            {{ isDeleting ? "Deleting..." : "Delete record" }}
          </button>
          <NuxtLink
            to="/admin/vendors/approved-vendors"
            class="portal-button portal-button--secondary"
          >
            Back to list
          </NuxtLink>
        </div>
      </form>

      <p
        v-else
        class="panel-copy"
      >
        Click Edit approved vendor to update mapping details.
      </p>
    </article>

    <article
      v-if="!pending && !error"
      class="vendor-panel"
    >
      <div class="vendor-panel__title">
        <h2>Imported sales records</h2>
      </div>

      <AppEmptyState
        v-if="data.importedSales.length === 0"
        title="No imported sales records"
        description="No imported sales currently map to this approved vendor."
      />

      <AppDataTable
        v-else
        :columns="salesColumns"
        :rows="data.importedSales"
        :row-key="(row) => row.saleRecordId"
        :mobile-columns="[
          'period',
          'title',
          'soldAt',
          'grossAmount',
          'commissionAmount'
        ]"
      >
        <template #cell:soldAt="{ row }">
          {{ formatDate(row.soldAt as string) }}
        </template>
        <template #cell:grossAmount="{ row }">
          {{
            formatCurrency(
              row.grossAmount as string,
              (row.currency as string) || "USD"
            )
          }}
        </template>
        <template #cell:commissionAmount="{ row }">
          {{
            formatCurrency(
              row.commissionAmount as string,
              (row.currency as string) || "USD"
            )
          }}
        </template>
      </AppDataTable>
    </article>
  </section>
</template>
