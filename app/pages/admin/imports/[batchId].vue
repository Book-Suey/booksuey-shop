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
  errors: BatchError[];
  unmappedSources: string[];
  nonVendorSources: string[];
}

const auth = useAdminAuth();
const route = useRoute();

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
        Inspect import metadata, row-level errors, and verified non-vendor
        rejections for this batch.
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
