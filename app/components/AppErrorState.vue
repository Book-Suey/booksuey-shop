<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title?: string
    message?: string
    retryLabel?: string
    showRetry?: boolean
  }>(),
  {
    title: 'Something went wrong',
    message: 'The request failed. Please try again.',
    retryLabel: 'Retry',
    showRetry: true
  }
)

const emit = defineEmits<{
  retry: []
}>()

function onRetry(): void {
  emit('retry')
}
</script>

<template>
  <section class="state-block state-block--error">
    <div class="state-block__inner">
      <UIcon
        name="i-lucide-triangle-alert"
        class="state-block__icon"
      />
      <h2 class="state-block__title">
        {{ props.title }}
      </h2>
      <p class="state-block__description">
        {{ props.message }}
      </p>
      <button
        v-if="props.showRetry"
        type="button"
        class="portal-button portal-button--secondary"
        @click="onRetry"
      >
        {{ props.retryLabel }}
      </button>
      <slot />
    </div>
  </section>
</template>
