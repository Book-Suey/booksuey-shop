<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface AdminImportRecord {
  batchId: string
  sourcePeriod: string
  createdAt: string
  status: 'completed' | 'failed' | 'flagged'
}

interface PayoutRequestRecord {
  payoutRequestId: string
  status:
    | 'requested'
    | 'approved'
    | 'disbursing'
    | 'paid'
    | 'failed'
    | 'rejected'
}

interface VendorRecord {
  vendorId: string
  currentBalance: string
}

interface ApprovedVendorRecord {
  basilId: string
  approvedVendorName: string
  isLinked: boolean
  totalSalesCount: number
}

interface ImportedSaleRecord {
  approvedVendorId: string
  approvedVendorName: string
  isLinked: boolean
  count: number
  totalCommission: string
}

const auth = useAdminAuth()

const { data, pending, error, refresh } = await useAsyncData(
  'admin-dashboard-overview',
  async () => {
    await auth.ensureInitialized()

    const importsData = await $fetch<{ imports: AdminImportRecord[] }>(
      '/api/admin/imports',
      {
        method: 'GET',
        query: { limit: 1 }
      }
    )

    const [payouts, vendors, approvedVendors, latestBatchDetails]
      = await Promise.all([
        $fetch<{ payoutRequests: PayoutRequestRecord[] }>(
          '/api/admin/payout-requests',
          {
            method: 'GET',
            query: { status: 'requested,approved,disbursing' }
          }
        ),
        $fetch<{ vendors: VendorRecord[] }>('/api/admin/vendors', {
          method: 'GET'
        }),
        $fetch<{ approvedVendors: ApprovedVendorRecord[] }>(
          '/api/admin/approved-vendors',
          {
            method: 'GET'
          }
        ),
        importsData.imports[0]
          ? $fetch<{ summary: ImportedSaleRecord[] }>(
              `/api/admin/imports/${importsData.imports[0].batchId}/summary`,
              {
                method: 'GET'
              }
            )
          : Promise.resolve({ summary: [] as ImportedSaleRecord[] })
      ])

    return {
      imports: importsData.imports,
      payoutRequests: payouts.payoutRequests,
      vendors: vendors.vendors,
      approvedVendors: approvedVendors.approvedVendors,
      latestBatchSummary: latestBatchDetails.summary
    }
  },
  {
    default: () => ({
      imports: [] as AdminImportRecord[],
      payoutRequests: [] as PayoutRequestRecord[],
      vendors: [] as VendorRecord[],
      approvedVendors: [] as ApprovedVendorRecord[],
      latestBatchSummary: [] as ImportedSaleRecord[]
    })
  }
)

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

const importSummaryColumns = [
  {
    key: 'approvedVendorName',
    label: 'Vendor Name',
    sortAccessor: (row: ImportedSaleRecord) => row.approvedVendorName
  },
  {
    key: 'count',
    label: 'Sales Count',
    sortAccessor: (row: ImportedSaleRecord) => row.count
  },
  {
    key: 'totalCommission',
    label: 'Total Commission',
    sortAccessor: (row: ImportedSaleRecord) =>
      Number.parseFloat(row.totalCommission || '0')
  },
  {
    key: 'linked',
    label: 'Account Status',
    sortAccessor: (row: ImportedSaleRecord) => (row.isLinked ? 0 : 1)
  }
]

const approvedVendorNameById = computed(() => {
  return new Map(
    data.value.approvedVendors.map(vendor => [
      vendor.basilId,
      vendor.approvedVendorName
    ])
  )
})

const latestBatchSummaryRows = computed(() => {
  return data.value.latestBatchSummary.map(row => ({
    ...row,
    approvedVendorName:
      approvedVendorNameById.value.get(row.approvedVendorId)
      || row.approvedVendorName
  }))
})

const cards = computed(() => {
  const latestImport = data.value.imports[0]
  const activePayouts = data.value.payoutRequests.length
  const totalVendorBalance = data.value.vendors.reduce(
    (sum, vendor) => sum + Number.parseFloat(vendor.currentBalance || '0'),
    0
  )
  const unlinkedVendorsWithSales = data.value.approvedVendors.filter(
    vendor => !vendor.isLinked && vendor.totalSalesCount > 0
  ).length

  return [
    {
      label: 'Latest Import',
      value: latestImport ? latestImport.sourcePeriod : '—',
      description: latestImport ? formatDate(latestImport.createdAt) : '',
      href: '/admin/imports',
      pageName: 'Imports'
    },
    {
      label: 'Payment Requests',
      value: String(activePayouts),
      description: 'Active requests',
      href: '/admin/payout-requests',
      pageName: 'Payouts'
    },
    {
      label: 'Total Vendor Balance',
      value: formatCurrency(String(totalVendorBalance)),
      description: 'Across all linked accounts',
      href: '/admin/vendors',
      pageName: 'Vendors'
    },
    {
      label: 'Unlinked Vendors',
      value: String(unlinkedVendorsWithSales),
      description: 'With sales records',
      href: '/admin/vendors/approved-vendors',
      pageName: 'Approved Vendors'
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
        <p
          v-if="card.description"
          class="panel-copy"
        >
          {{ card.description }}
        </p>
        <NuxtLink
          :to="card.href"
          class="auth-inline-link"
        >
          Open {{ card.pageName }}
        </NuxtLink>
      </article>
    </div>

    <article
      v-if="!pending && !error && latestBatchSummaryRows.length > 0"
      class="vendor-panel"
    >
      <div class="vendor-panel__title">
        <h2>Latest import summary</h2>
      </div>

      <AppDataTable
        :columns="importSummaryColumns"
        :rows="latestBatchSummaryRows"
        :sortable-columns="importSummaryColumns.map((column) => column.key)"
        :row-key="(row) => row.approvedVendorId"
      >
        <template #cell:totalCommission="{ row }">
          {{ formatCurrency(row.totalCommission as string) }}
        </template>
        <template #cell:linked="{ row }">
          <AppStatusBadge
            :status="(row.isLinked as boolean) ? 'active' : 'inactive'"
            :label="(row.isLinked as boolean) ? 'Linked' : 'Unlinked'"
          />
        </template>
      </AppDataTable>
    </article>
  </section>
</template>
