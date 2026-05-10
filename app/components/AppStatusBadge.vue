<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    status?: string
    label?: string
  }>(),
  {
    status: 'unknown'
  }
)

const normalizedStatus = computed(() => props.status.toLowerCase())
const displayText = computed(() => props.label || props.status)
const toneClass = computed(() => {
  if (
    ['paid', 'completed', 'active', 'approved', 'success'].includes(
      normalizedStatus.value
    )
  ) {
    return 'state-badge--success'
  }

  if (
    ['failed', 'rejected', 'disabled', 'error'].includes(normalizedStatus.value)
  ) {
    return 'state-badge--error'
  }

  if (
    ['requested', 'disbursing', 'pending', 'processing'].includes(
      normalizedStatus.value
    )
  ) {
    return 'state-badge--warn'
  }

  return 'state-badge--neutral'
})
</script>

<template>
  <span
    class="state-badge"
    :class="toneClass"
  >
    {{ displayText }}
  </span>
</template>
