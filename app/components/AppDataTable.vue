<script setup lang="ts" generic="TRow extends object">
const props = defineProps<{
  columns: Array<{ key: string, label: string }>
  rows: TRow[]
  rowKey: (row: TRow, index: number) => string
  stackOnMobile?: boolean
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

function getRowCanExpand(row: { original: TRow }): boolean {
  if (!hasExpandedSlot.value) {
    return false
  }

  if (!props.rowExpandable) {
    return true
  }

  return props.rowExpandable(row.original)
}
</script>

<template>
  <div
    class="table-shell"
    :class="{ 'table-shell--preserve-columns': props.stackOnMobile === false }"
    :style="{ '--table-column-count': String(props.columns.length) }"
  >
    <UTable
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
  </div>
</template>
