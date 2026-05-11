<script setup lang="ts" generic="TRow extends object">
const props = defineProps<{
  columns: Array<{ key: string, label: string }>
  rows: TRow[]
  rowKey: (row: TRow, index: number) => string
  stackOnMobile?: boolean
  mobileColumns?: string[]
  rowExpandable?: (row: TRow) => boolean
}>()

const slots = useSlots()

const tableColumns = computed(() =>
  props.columns.map(column => ({
    accessorKey: column.key,
    header: column.label
  }))
)

const hasExpandedSlot = computed(() => Boolean(slots.expanded))

const useMobileCards = computed(() => props.stackOnMobile !== false)

const mobileColumns = computed(() => {
  if (!props.mobileColumns || props.mobileColumns.length === 0) {
    return props.columns
  }

  const byKey = new Map(props.columns.map(column => [column.key, column]))

  return props.mobileColumns
    .map(key => byKey.get(key))
    .filter((column): column is { key: string, label: string } =>
      Boolean(column)
    )
})

function getRowCanExpand(row: { original: TRow }): boolean {
  if (!hasExpandedSlot.value) {
    return false
  }

  if (!props.rowExpandable) {
    return true
  }

  return props.rowExpandable(row.original)
}

function getCellValue(row: TRow, key: string): unknown {
  const segments = key.split('.')
  let current: unknown = row

  for (const segment of segments) {
    if (
      current === null
      || current === undefined
      || typeof current !== 'object'
    ) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
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
        empty: 'table-shell__empty'
      }"
      empty="No records found."
    >
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

    <div
      v-if="useMobileCards"
      class="table-shell__mobile"
    >
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
              'table-shell__mobile-item--actions': column.key === 'actions'
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
                  getIsExpanded: () => false
                }"
                :value="getCellValue(row, column.key)"
              >
                {{ getCellValue(row, column.key) }}
              </slot>
            </dd>
          </div>
        </dl>
      </article>

      <p
        v-if="props.rows.length === 0"
        class="table-shell__mobile-empty"
      >
        No records found.
      </p>
    </div>
  </div>
</template>
