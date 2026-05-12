<script setup lang="ts" generic="TRow extends object">
const props = defineProps<{
  columns: Array<{
    key: string;
    label: string;
    sortAccessor?: (row: TRow) => unknown;
  }>;
  rows: TRow[];
  rowKey: (row: TRow, index: number) => string;
  stackOnMobile?: boolean;
  mobileColumns?: string[];
  sortableColumns?: string[];
  rowExpandable?: (row: TRow) => boolean;
}>();

const slots = useSlots();
const sorting = ref<Array<{ id: string; desc: boolean }>>([]);

const sortableColumnKeys = computed(() => new Set(props.sortableColumns || []));

const tableColumns = computed(() =>
  props.columns.map((column) => ({
    accessorKey: column.sortAccessor ? undefined : column.key,
    accessorFn: column.sortAccessor,
    id: column.key,
    header: column.label,
    enableSorting: sortableColumnKeys.value.has(column.key),
  })),
);

const hasExpandedSlot = computed(() => Boolean(slots.expanded));

const useMobileCards = computed(() => props.stackOnMobile !== false);

const mobileColumns = computed(() => {
  if (!props.mobileColumns || props.mobileColumns.length === 0) {
    return props.columns;
  }

  const byKey = new Map(props.columns.map((column) => [column.key, column]));

  return props.mobileColumns
    .map((key) => byKey.get(key))
    .filter((column): column is { key: string; label: string } =>
      Boolean(column),
    );
});

function getRowCanExpand(row: { original: TRow }): boolean {
  if (!hasExpandedSlot.value) {
    return false;
  }

  if (!props.rowExpandable) {
    return true;
  }

  return props.rowExpandable(row.original);
}

function getCellValue(row: TRow, key: string): unknown {
  const segments = key.split(".");
  let current: unknown = row;

  for (const segment of segments) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function isColumnSortable(columnKey: string): boolean {
  return sortableColumnKeys.value.has(columnKey);
}

function getSortIcon(columnKey: string): string {
  const sortedColumn = sorting.value.find((item) => item.id === columnKey);
  if (!sortedColumn) {
    return "i-lucide-arrow-up-down";
  }

  return sortedColumn.desc ? "i-lucide-arrow-down" : "i-lucide-arrow-up";
}
</script>

<template>
  <div
    class="table-shell"
    :class="{ 'table-shell--preserve-columns': props.stackOnMobile === false }"
    :style="{ '--table-column-count': String(props.columns.length) }"
  >
    <UTable
      class="table-shell__desktop"
      :data="props.rows"
      :columns="tableColumns"
      v-model:sorting="sorting"
      :get-row-id="props.rowKey"
      :expanded-options="{ getRowCanExpand }"
      sticky="header"
      :ui="{
        root: 'table-shell__table-root',
        base: 'table-shell__table-base',
        thead: 'table-shell__thead',
        tbody: 'table-shell__tbody',
        tr: 'table-shell__tr',
        th: 'table-shell__th',
        td: 'table-shell__td',
        separator: 'table-shell__separator',
        empty: 'table-shell__empty',
      }"
      empty="No records found."
    >
      <template
        v-for="column in props.columns"
        :key="`${column.key}-header`"
        #[`${column.key}-header`]="slotProps"
      >
        <slot
          :name="`header:${column.key}`"
          :column="slotProps.column"
          :table="slotProps.table"
        >
          <button
            v-if="isColumnSortable(column.key)"
            type="button"
            class="inline-flex w-full items-center gap-1 text-left"
            @click="
              slotProps.column.toggleSorting(
                slotProps.column.getIsSorted() === 'asc',
              )
            "
          >
            <span>{{ column.label }}</span>
            <UIcon :name="getSortIcon(column.key)" class="h-4 w-4" />
          </button>
          <span v-else>{{ column.label }}</span>
        </slot>
      </template>

      <template
        v-for="column in props.columns"
        :key="column.key"
        #[`${column.key}-cell`]="slotProps"
      >
        <slot
          :name="`cell:${column.key}`"
          :row="slotProps.row.original"
          :table-row="slotProps.row"
          :value="slotProps.getValue()"
        >
          {{ slotProps.getValue() }}
        </slot>
      </template>

      <template #expanded="slotProps">
        <slot
          name="expanded"
          :row="slotProps.row.original"
          :table-row="slotProps.row"
        />
      </template>
    </UTable>

    <div v-if="useMobileCards" class="table-shell__mobile">
      <article
        v-for="(row, rowIndex) in props.rows"
        :key="props.rowKey(row, rowIndex)"
        class="table-shell__mobile-card"
      >
        <dl class="table-shell__mobile-list">
          <div
            v-for="column in mobileColumns"
            :key="column.key"
            class="table-shell__mobile-item"
            :class="{
              'table-shell__mobile-item--actions': column.key === 'actions',
            }"
          >
            <dt class="table-shell__mobile-label">
              {{ column.label }}
            </dt>
            <dd class="table-shell__mobile-value">
              <slot
                :name="`cell:${column.key}`"
                :row="row"
                :table-row="{
                  getCanExpand: () => false,
                  toggleExpanded: () => {},
                  getIsExpanded: () => false,
                }"
                :value="getCellValue(row, column.key)"
              >
                {{ getCellValue(row, column.key) }}
              </slot>
            </dd>
          </div>
        </dl>
      </article>

      <p v-if="props.rows.length === 0" class="table-shell__mobile-empty">
        No records found.
      </p>
    </div>
  </div>
</template>
