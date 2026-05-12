<script setup lang="ts">
definePageMeta({
  middleware: "admin-auth",
  layout: "admin",
  pageTransition: false,
  layoutTransition: false,
});

interface BatchError {
  code: string;
  rowNumber: number;
  reason: string;
  hint: string;
}

interface BatchDuplicateDetail {
  rowNumber: number;
  source: string;
  saleOrderId: string;
  title: string;
  quantity: number;
  unit: string;
  discount: string;
  extended: string;
  cost: string;
  credit: string;
  soldAt: string;
  sourceRowKey: string;
  duplicateKind: "within-upload" | "existing-sale";
  matchedRowNumber?: number;
  existingBatchId?: string;
  manualImportStatus: "not_requested" | "requested" | "imported";
  manualImportRequestedAt?: string;
  manualImportRequestedBy?: string;
  manualImportImportedAt?: string;
  manualImportImportedBy?: string;
  manualImportSaleRecordId?: string;
}

interface BatchDetail {
  batchId: string;
  sourcePeriod: string;
  uploadedBy: string;
  uploadedAt: string;
  status: "completed" | "failed";
  checksum: string;
  summary: {
    total: number;
    accepted: number;
    rejected: number;
    nonVendorRejected: number;
    duplicates: number;
  };
  duplicateDetails: BatchDuplicateDetail[];
  errors: BatchError[];
  unmappedSources: string[];
  nonVendorSources: string[];
}

const auth = useAdminAuth();
const route = useRoute();
const requestingManualImportRow = ref<number | null>(null);
const manualImportRequestError = ref<string | null>(null);
const manualImportRequestSuccess = ref<string | null>(null);

const batchId = computed(() => {
  const rawValue = Array.isArray(route.params.batchId)
    ? route.params.batchId[0]
    : route.params.batchId;

  const value = String(rawValue || "");

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
});

const batchAuditPath = computed(() => {
  return `/admin/audit?entityType=SalesImportBatch&entityId=${encodeURIComponent(batchId.value)}`;
});

function toBatchDetailPath(targetBatchId: string): string {
  return `/admin/imports/${encodeURIComponent(targetBatchId)}`;
}

function formatDate(value: string): string {
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

function duplicateDetailKey(detail: BatchDuplicateDetail): string {
  return `${detail.rowNumber}-${detail.sourceRowKey}`;
}

function duplicateReasonLabel(detail: BatchDuplicateDetail): string {
  return detail.duplicateKind === "within-upload"
    ? "Repeated in upload"
    : "Matches imported sale";
}

function duplicateReasonCopy(detail: BatchDuplicateDetail): string {
  if (detail.duplicateKind === "within-upload") {
    return detail.matchedRowNumber
      ? `This row matches row ${detail.matchedRowNumber} in the same upload.`
      : "This row repeats another row in the same upload.";
  }

  return detail.existingBatchId
    ? `This row matches a sale that was already imported in batch ${detail.existingBatchId}.`
    : "This row matches a sale that was already imported.";
}

const duplicateDetails = computed(() => {
  return [...data.value.batch.duplicateDetails].sort((left, right) => {
    return left.rowNumber - right.rowNumber;
  });
});

async function requestManualImport(rowNumber: number): Promise<void> {
  manualImportRequestError.value = null;
  manualImportRequestSuccess.value = null;
  requestingManualImportRow.value = rowNumber;

  try {
    await auth.ensureInitialized();

    await $fetch(
      `/api/admin/sales/${encodeURIComponent(batchId.value)}/duplicates/${rowNumber}/manual-import`,
      {
        method: "POST",
        headers: auth.authHeaders(),
      },
    );

    manualImportRequestSuccess.value = `Row ${rowNumber} was flagged for manual import review.`;
    await refresh();
  } catch (requestError: unknown) {
    manualImportRequestError.value =
      (requestError as { statusMessage?: string })?.statusMessage ||
      "Unable to flag this duplicate row for manual import review.";
  } finally {
    requestingManualImportRow.value = null;
  }
}

const { data, pending, error, refresh } = useAsyncData(
  () => `admin-import-batch-${batchId.value}`,
  async () => {
    await auth.ensureInitialized();

    return await $fetch<{ batch: BatchDetail }>(
      `/api/admin/sales/${encodeURIComponent(batchId.value)}`,
      {
        method: "GET",
        headers: auth.authHeaders(),
      },
    );
  },
  {
    server: false,
    default: () => ({
      batch: {
        batchId: "",
        sourcePeriod: "",
        uploadedBy: "",
        uploadedAt: new Date().toISOString(),
        status: "completed" as const,
        checksum: "",
        summary: {
          total: 0,
          accepted: 0,
          rejected: 0,
          nonVendorRejected: 0,
          duplicates: 0,
        },
        duplicateDetails: [] as BatchDuplicateDetail[],
        errors: [] as BatchError[],
        unmappedSources: [] as string[],
        nonVendorSources: [] as string[],
      },
    }),
  },
);

const outcomeColumns = [
  { key: "metric", label: "Metric" },
  { key: "value", label: "Value" },
  { key: "notes", label: "Notes" },
];

const errorColumns = [
  { key: "reason", label: "Reason" },
  { key: "hint", label: "Hint" },
  { key: "count", label: "Count" },
];

const errorSummaryRows = computed(() => {
  const summaryByReasonHint = new Map<
    string,
    { reason: string; hint: string; count: number }
  >();

  for (const batchError of data.value.batch.errors) {
    const mapKey = `${batchError.reason}|||${batchError.hint}`;
    const current = summaryByReasonHint.get(mapKey);

    if (current) {
      current.count += 1;
      continue;
    }

    summaryByReasonHint.set(mapKey, {
      reason: batchError.reason,
      hint: batchError.hint,
      count: 1,
    });
  }

  return Array.from(summaryByReasonHint.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.reason.localeCompare(right.reason);
  });
});

const outcomeRows = computed(() => {
  const batch = data.value.batch;

  return [
    {
      metric: "Accepted rows",
      value: String(batch.summary.accepted),
      notes:
        batch.summary.accepted > 0
          ? "Imported into ledger"
          : "No accepted rows",
    },
    {
      metric: "Rejected rows",
      value: String(batch.summary.rejected),
      notes:
        batch.summary.rejected > 0
          ? "Includes errors and verified non-vendor rows"
          : "No rejected rows",
    },
    {
      metric: "Verified non-vendor rows",
      value: String(batch.summary.nonVendorRejected),
      notes:
        batch.summary.nonVendorRejected > 0
          ? "Intentionally rejected"
          : "No verified non-vendor rows",
    },
    {
      metric: "Duplicates",
      value: String(batch.summary.duplicates),
      notes:
        batch.summary.duplicates > 0
          ? "Skipped as duplicates"
          : "No duplicates",
    },
    {
      metric: "Unmapped sources",
      value: String(batch.unmappedSources.length),
      notes:
        batch.unmappedSources.length > 0
          ? "Needs source mapping"
          : "Fully mapped",
    },
  ];
});
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">Batch {{ batchId }}</h1>
      <p class="auth-copy">
        Inspect import metadata, row-level errors, duplicate rows, and verified
        non-vendor rejections for this batch.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          to="/admin/imports"
          class="portal-button portal-button--secondary"
        >
          Back to import history
        </NuxtLink>
        <NuxtLink
          :to="batchAuditPath"
          class="portal-button portal-button--secondary"
        >
          View batch audit events
        </NuxtLink>
        <NuxtLink
          to="/admin/imports/upload"
          class="portal-button portal-button--primary"
        >
          Upload another batch
        </NuxtLink>
        <NuxtLink
          to="/admin/imports/manual-review"
          class="portal-button portal-button--secondary"
        >
          Manual import review queue
        </NuxtLink>
      </div>
    </header>

    <AppLoadingState
      v-if="pending"
      title="Loading batch detail"
      description="Fetching the import summary, row errors, and source mapping results."
    />

    <AppErrorState
      v-else-if="error"
      title="Unable to load batch"
      :message="
        (error as { statusMessage?: string })?.statusMessage ||
        'Batch detail request failed.'
      "
      @retry="refresh"
    />

    <template v-else>
      <section class="import-detail-grid">
        <article class="admin-card">
          <p class="admin-card__label">Source period</p>
          <p class="admin-card__value">
            {{ data.batch.sourcePeriod }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Uploaded at</p>
          <p class="admin-card__value">
            {{ formatDate(data.batch.uploadedAt) }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Uploaded by</p>
          <p class="admin-card__value">
            {{ data.batch.uploadedBy }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Status</p>
          <p class="admin-card__value">
            <AppStatusBadge :status="data.batch.status" />
          </p>
        </article>
      </section>

      <section class="import-detail-grid">
        <article class="admin-card">
          <p class="admin-card__label">Total rows</p>
          <p class="admin-card__value">
            {{ data.batch.summary.total }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Accepted</p>
          <p class="admin-card__value">
            {{ data.batch.summary.accepted }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Rejected</p>
          <p class="admin-card__value">
            {{ data.batch.summary.rejected }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Duplicates</p>
          <p class="admin-card__value">
            {{ data.batch.summary.duplicates }}
          </p>
        </article>

        <article class="admin-card">
          <p class="admin-card__label">Non-vendor rejected</p>
          <p class="admin-card__value">
            {{ data.batch.summary.nonVendorRejected }}
          </p>
        </article>
      </section>

      <article class="vendor-panel">
        <h2>Batch outcomes</h2>

        <AppDataTable
          :columns="outcomeColumns"
          :rows="outcomeRows"
          :row-key="(row) => row.metric as string"
        />
      </article>

      <article class="vendor-panel stack-grid">
        <div>
          <h2>Batch metadata</h2>
          <p class="panel-copy">
            Checksum: <strong>{{ data.batch.checksum }}</strong>
          </p>
        </div>

        <div>
          <h2>Rejected error summary</h2>

          <AppEmptyState
            v-if="data.batch.errors.length === 0"
            title="No errors"
            description="This batch did not record any row-level validation issues."
          />

          <AppDataTable
            v-else
            :columns="errorColumns"
            :rows="errorSummaryRows"
            :row-key="(row) => `${row.reason}-${row.hint}`"
          />
        </div>

        <div>
          <h2>Duplicate rows</h2>

          <p class="panel-copy">
            Review skipped duplicates before requesting any manual import
            follow-up.
          </p>

          <NuxtLink to="/admin/imports/manual-review" class="detail-list__link">
            Open manual import review queue
          </NuxtLink>

          <p v-if="manualImportRequestError" class="auth-error">
            {{ manualImportRequestError }}
          </p>

          <p v-if="manualImportRequestSuccess" class="auth-success">
            {{ manualImportRequestSuccess }}
          </p>

          <AppEmptyState
            v-if="duplicateDetails.length === 0"
            title="No duplicate rows"
            description="Every accepted row was unique across this upload and existing sale records."
          />

          <div v-else class="detail-list">
            <article
              v-for="duplicateDetail in duplicateDetails"
              :key="duplicateDetailKey(duplicateDetail)"
              class="detail-list__row"
            >
              <span class="detail-list__eyebrow">
                Row {{ duplicateDetail.rowNumber }} •
                {{ duplicateReasonLabel(duplicateDetail) }}
              </span>
              <p class="detail-list__title">
                {{ duplicateDetail.source }} • {{ duplicateDetail.title }}
              </p>
              <p class="detail-list__copy">
                Sale/Order ID {{ duplicateDetail.saleOrderId }} • Sold
                {{ formatDate(duplicateDetail.soldAt) }} • Qty
                {{ duplicateDetail.quantity }} • Extended ${{
                  duplicateDetail.extended
                }}
              </p>
              <p class="detail-list__copy">
                {{ duplicateReasonCopy(duplicateDetail) }}
              </p>
              <NuxtLink
                v-if="duplicateDetail.existingBatchId"
                :to="toBatchDetailPath(duplicateDetail.existingBatchId)"
                class="detail-list__link"
              >
                Open original batch
              </NuxtLink>
              <div class="detail-list__actions">
                <p
                  v-if="duplicateDetail.manualImportStatus === 'requested'"
                  class="detail-list__status"
                >
                  Manual import requested
                  <template v-if="duplicateDetail.manualImportRequestedBy">
                    by {{ duplicateDetail.manualImportRequestedBy }}
                  </template>
                  <template v-if="duplicateDetail.manualImportRequestedAt">
                    on {{ formatDate(duplicateDetail.manualImportRequestedAt) }}
                  </template>
                </p>
                <p
                  v-else-if="duplicateDetail.manualImportStatus === 'imported'"
                  class="detail-list__status"
                >
                  Imported to sales
                  <template v-if="duplicateDetail.manualImportImportedBy">
                    by {{ duplicateDetail.manualImportImportedBy }}
                  </template>
                  <template v-if="duplicateDetail.manualImportImportedAt">
                    on {{ formatDate(duplicateDetail.manualImportImportedAt) }}
                  </template>
                </p>
                <button
                  v-else
                  type="button"
                  class="portal-button portal-button--secondary"
                  :disabled="
                    requestingManualImportRow === duplicateDetail.rowNumber
                  "
                  @click="requestManualImport(duplicateDetail.rowNumber)"
                >
                  {{
                    requestingManualImportRow === duplicateDetail.rowNumber
                      ? "Flagging..."
                      : "Flag for manual import"
                  }}
                </button>
              </div>
            </article>
          </div>
        </div>

        <div>
          <h2>Verified non-vendor sources</h2>

          <AppEmptyState
            v-if="data.batch.nonVendorSources.length === 0"
            title="No verified non-vendor rows"
            description="No rows matched the verified non-vendor source list for this batch."
          />

          <ul v-else class="compact-list">
            <li v-for="source in data.batch.nonVendorSources" :key="source">
              {{ source }}
            </li>
          </ul>
        </div>

        <div>
          <h2>Unmapped sources</h2>

          <AppEmptyState
            v-if="data.batch.unmappedSources.length === 0"
            title="No unmapped sources"
            description="Every source in this batch matched an approved vendor mapping."
          />

          <ul v-else class="compact-list">
            <li v-for="source in data.batch.unmappedSources" :key="source">
              {{ source }}
            </li>
          </ul>
        </div>
      </article>
    </template>
  </section>
</template>
