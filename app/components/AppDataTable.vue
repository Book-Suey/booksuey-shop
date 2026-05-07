<script setup lang="ts" generic="TRow extends object">
const props = defineProps<{
  columns: Array<{ key: string, label: string }>
  rows: TRow[]
  rowKey: (row: TRow, index: number) => string
}>()

function getCellValue(row: TRow, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}
</script>

<template>
  <div class="table-shell">
    <div class="table-shell__header">
      <span
        v-for="column in props.columns"
        :key="column.key"
      >
        {{ column.label }}
      </span>
    </div>

    <div
      v-for="(row, index) in props.rows"
      :key="props.rowKey(row, index)"
      class="table-shell__row"
    >
      <span
        v-for="column in props.columns"
        :key="column.key"
      >
        <slot
          :name="`cell:${column.key}`"
          :row="row"
          :value="getCellValue(row, column.key)"
        >
          {{ getCellValue(row, column.key) }}
        </slot>
      </span>
    </div>
  </div>
</template>
