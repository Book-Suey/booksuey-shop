<script setup lang="ts">
definePageMeta({
  middleware: 'vendor-auth',
  layout: 'vendor'
})

interface VendorSale {
  saleRecordId: string
  sourceBatchId: string
  sourcePeriod: string
  soldAt: string
  title: string
  quantity: number
  unit: string
  discount: string
  extended: string
  grossAmount: string
  commissionAmount: string
  currency: string
}

const auth = useVendorAuth()
const hasMounted = ref(false)

const columns = [
  { key: 'soldAt', label: 'Sold At' },
  { key: 'sourcePeriod', label: 'Period' },
  { key: 'title', label: 'Title' },
  { key: 'quantity', label: 'Qty' },
  { key: 'unit', label: 'Unit Price' },
  { key: 'discount', label: 'Discount' },
  { key: 'grossAmount', label: 'Gross Sale' },
  { key: 'commissionAmount', label: 'Commission' }
]

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

function formatDate(value: string): string {
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

const { data, pending, error, refresh } = await useAsyncData(
  'vendor-sales-page',
  async () => {
    await auth.ensureInitialized()

    return await $fetch<{ sales: VendorSale[] }>('/api/vendor/sales', {
      method: 'GET',
      headers: auth.authHeaders()
    })
  },
  {
    server: false,
    immediate: false,
    default: () => ({ sales: [] as VendorSale[] })
  }
)

onMounted(async () => {
  hasMounted.value = true
  await refresh()
})
</script>

<template>
  <section class="vendor-page">
    <header class="vendor-page__header">
      <h1 class="auth-title">
        Imported sales records
      </h1>
      <p class="auth-copy">
        Review every imported sale record by source period.
      </p>
    </header>

    <AppLoadingState
      v-if="hasMounted && pending"
      title="Loading sales"
      description="Fetching your imported sales history."
    />

    <AppErrorState
      v-else-if="hasMounted && error"
      title="Unable to load sales"
      :message="
        (error as { statusMessage?: string })?.statusMessage
          || 'Sales request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="data.sales.length === 0"
      title="No sales records"
      description="Sales rows will appear after an admin import assigns records to your vendor account."
    />

    <article
      v-else
      class="vendor-panel"
    >
      <AppDataTable
        :columns="columns"
        :rows="data.sales"
        :row-key="(row) => row.saleRecordId"
        :stack-on-mobile="true"
      >
        <template #cell:soldAt="{ row }">
          {{ formatDate(row.soldAt as string) }}
        </template>
        <template #cell:unit="{ row }">
          {{ formatCurrency(row.unit as string, row.currency as string) }}
        </template>
        <template #cell:discount="{ row }">
          {{ formatCurrency(row.discount as string, row.currency as string) }}
        </template>
        <template #cell:grossAmount="{ row }">
          {{
            formatCurrency(row.grossAmount as string, row.currency as string)
          }}
        </template>
        <template #cell:commissionAmount="{ row }">
          {{
            formatCurrency(
              row.commissionAmount as string,
              row.currency as string
            )
          }}
        </template>
      </AppDataTable>
    </article>
  </section>
</template>
