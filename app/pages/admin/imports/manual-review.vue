<script setup lang="ts">
definePageMeta({
  middleware: "admin-auth",
  layout: "admin",
});

interface ManualImportReviewRow {
  batchId: string;
  sourcePeriod: string;
  uploadedAt: string;
  rowNumber: number;
  source: string;
  saleOrderId: string;
  title: string;
  quantity: number;
  extended: string;
  soldAt: string;
  duplicateKind: "within-upload" | "existing-sale";
  matchedRowNumber?: number;
  existingBatchId?: string;
  manualImportStatus: "not_requested" | "requested" | "imported";
  manualImportRequestedAt?: string;
  manualImportRequestedBy?: string;
}

const auth = useAdminAuth();
const importingRowKey = ref<string | null>(null);
const importSuccess = ref<string | null>(null);
const importError = ref<string | null>(null);

const filters = reactive({
  sourcePeriod: "",
  batchId: "",
  duplicateKind: "all",
  dateFrom: "",
  dateTo: "",
});

const columns = [
  { key: "requestedAt", label: "Requested" },
  { key: "batch", label: "Batch" },
  { key: "row", label: "Row" },
  { key: "duplicateKind", label: "Reason" },
  { key: "sale", label: "Sale Detail" },
  { key: "requestedBy", label: "Requested By" },
  { key: "actions", label: "Actions" },
];

function toIsoBoundary(
  value: string,
  boundary: "start" | "end",
): string | undefined {
  if (!value) {
    return undefined;
  }

  const suffix = boundary === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  return new Date(`${value}${suffix}`).toISOString();
}

function formatDate(value?: string): string {
  if (!value) {
    return "n/a";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toBatchDetailPath(batchId: string): string {
  return `/admin/imports/${encodeURIComponent(batchId)}`;
}

function reviewRowKey(row: ManualImportReviewRow): string {
  return `${row.batchId}:${row.rowNumber}`;
}

function duplicateReasonLabel(row: ManualImportReviewRow): string {
  return row.duplicateKind === "within-upload"
    ? "Repeated in upload"
    : "Matches imported sale";
}

function duplicateReasonCopy(row: ManualImportReviewRow): string {
  if (row.duplicateKind === "within-upload") {
    return row.matchedRowNumber
      ? `Matches row ${row.matchedRowNumber} in the same upload.`
      : "Matches another row in the same upload.";
  }

  return row.existingBatchId
    ? `Matches sale already imported in batch ${row.existingBatchId}.`
    : "Matches a previously imported sale.";
}

async function importReviewedRow(row: ManualImportReviewRow): Promise<void> {
  importError.value = null;
  importSuccess.value = null;
  importingRowKey.value = reviewRowKey(row);

  try {
    await auth.ensureInitialized();

    const result = await $fetch<{
      imported: boolean;
      status: "imported" | "already_imported";
      saleRecordId?: string;
    }>(
      `/api/admin/sales/${encodeURIComponent(row.batchId)}/duplicates/${row.rowNumber}/import`,
      {
        method: "POST",
        headers: auth.authHeaders(),
      },
    );

    if (result.status === "already_imported") {
      importSuccess.value = `Row ${row.rowNumber} was already imported earlier.`;
    } else {
      importSuccess.value = `Row ${row.rowNumber} imported to sales and ledger${result.saleRecordId ? ` (${result.saleRecordId})` : ""}.`;
    }

    await refresh();
  } catch (requestError: unknown) {
    importError.value =
      (requestError as { statusMessage?: string })?.statusMessage ||
      "Unable to import this reviewed row right now.";
  } finally {
    importingRowKey.value = null;
  }
}

const { data, pending, error, refresh } = await useAsyncData(
  "admin-manual-import-review-queue",
  async () => {
    await auth.ensureInitialized();

    const query: Record<string, string | number> = {
      limit: 200,
    };

    if (filters.sourcePeriod.trim()) {
      query.sourcePeriod = filters.sourcePeriod.trim();
    }

    if (filters.batchId.trim()) {
      query.batchId = filters.batchId.trim();
    }

    if (filters.duplicateKind !== "all") {
      query.duplicateKind = filters.duplicateKind;
    }

    const dateFrom = toIsoBoundary(filters.dateFrom, "start");
    const dateTo = toIsoBoundary(filters.dateTo, "end");

    if (dateFrom) {
      query.dateFrom = dateFrom;
    }

    if (dateTo) {
      query.dateTo = dateTo;
    }

    return await $fetch<{ rows: ManualImportReviewRow[] }>(
      "/api/admin/sales/duplicates/manual-review",
      {
        method: "GET",
        headers: auth.authHeaders(),
        query,
      },
    );
  },
  {
    server: false,
    watch: [
      () => filters.sourcePeriod,
      () => filters.batchId,
      () => filters.duplicateKind,
      () => filters.dateFrom,
      () => filters.dateTo,
    ],
    default: () => ({ rows: [] as ManualImportReviewRow[] }),
  },
);

const metrics = computed(() => {
  const rows = data.value.rows;

  return {
    total: rows.length,
    existingSale: rows.filter((row) => row.duplicateKind === "existing-sale")
      .length,
    withinUpload: rows.filter((row) => row.duplicateKind === "within-upload")
      .length,
  };
});
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">Manual import review queue</h1>
      <p class="auth-copy">
        Review duplicate rows that admins marked for manual import follow-up.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/imports"
          class="portal-button portal-button--secondary"
        >
          Back to import history
        </NuxtLink>
      </div>
    </header>

    <section class="admin-cards">
      <article class="admin-card">
        <p class="admin-card__label">Rows in queue</p>
        <p class="admin-card__value">
          {{ metrics.total }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">Existing-sale duplicates</p>
        <p class="admin-card__value">
          {{ metrics.existingSale }}
        </p>
      </article>

      <article class="admin-card">
        <p class="admin-card__label">Within-upload duplicates</p>
        <p class="admin-card__value">
          {{ metrics.withinUpload }}
        </p>
      </article>
    </section>

    <article class="vendor-panel">
      <h2>Filters</h2>

      <form class="auth-form filter-grid">
        <label>
          <span>Duplicate reason</span>
          <select v-model="filters.duplicateKind">
            <option value="all">All</option>
            <option value="existing-sale">Existing sale</option>
            <option value="within-upload">Within upload</option>
          </select>
        </label>

        <label>
          <span>Source period</span>
          <input
            v-model="filters.sourcePeriod"
            type="text"
            placeholder="2026-Q2"
          />
        </label>

        <label>
          <span>Batch ID</span>
          <input
            v-model="filters.batchId"
            type="text"
            placeholder="batch_..."
          />
        </label>

        <label>
          <span>Requested from</span>
          <input v-model="filters.dateFrom" type="date" />
        </label>

        <label>
          <span>Requested to</span>
          <input v-model="filters.dateTo" type="date" />
        </label>
      </form>
    </article>

    <AppLoadingState
      v-if="pending"
      title="Loading queue"
      description="Fetching duplicate rows flagged for manual import review."
    />

    <p v-if="importError" class="auth-error">
      {{ importError }}
    </p>

    <p v-if="importSuccess" class="auth-success">
      {{ importSuccess }}
    </p>

    <AppErrorState
      v-else-if="error"
      title="Unable to load queue"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Manual import review queue request failed.'
      "
      @retry="refresh"
    />

    <AppEmptyState
      v-else-if="data.rows.length === 0"
      title="No rows in manual review"
      description="Flag duplicate rows from a batch detail page to add them to this queue."
    />

    <AppDataTable
      v-else
      :columns="columns"
      :rows="data.rows"
      :row-key="(row) => `${row.batchId}-${row.rowNumber}`"
      :mobile-columns="[
        'requestedAt',
        'row',
        'duplicateKind',
        'sale',
        'actions',
      ]"
    >
      <template #cell:requestedAt="{ row }">
        {{ formatDate(row.manualImportRequestedAt as string | undefined) }}
      </template>

      <template #cell:batch="{ row }">
        {{ row.sourcePeriod as string }} • {{ row.batchId as string }}
      </template>

      <template #cell:row="{ row }">
        Row {{ row.rowNumber as number }}
      </template>

      <template #cell:duplicateKind="{ row }">
        {{ duplicateReasonLabel(row as ManualImportReviewRow) }}
      </template>

      <template #cell:sale="{ row }">
        {{ row.source as string }} • {{ row.title as string }}
        <br />
        Sale/Order {{ row.saleOrderId as string }} • Sold
        {{ formatDate(row.soldAt as string) }} • Qty
        {{ row.quantity as number }} • Extended ${{ row.extended as string }}
        <br />
        {{ duplicateReasonCopy(row as ManualImportReviewRow) }}
      </template>

      <template #cell:requestedBy="{ row }">
        {{ (row.manualImportRequestedBy as string) || "unknown" }}
      </template>

      <template #cell:actions="{ row }">
        <div class="table-actions">
          <a :href="toBatchDetailPath(row.batchId as string)"
            >Open flagged batch</a
          >
          <a
            v-if="row.existingBatchId"
            :href="toBatchDetailPath(row.existingBatchId as string)"
          >
            Open original batch
          </a>
          <button
            type="button"
            class="portal-button portal-button--primary"
            :disabled="
              importingRowKey ===
              `${row.batchId as string}:${row.rowNumber as number}`
            "
            @click="importReviewedRow(row as ManualImportReviewRow)"
          >
            {{
              importingRowKey ===
              `${row.batchId as string}:${row.rowNumber as number}`
                ? "Importing..."
                : "Import to sales"
            }}
          </button>
        </div>
      </template>
    </AppDataTable>
  </section>
</template>
