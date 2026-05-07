<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  {
    title: 'No records found',
    description: 'Try adjusting your filters or create a new record.'
  }
)
</script>

<template>
  <section class="state-block state-block--empty">
    <div class="state-block__inner">
      <UIcon
        name="i-lucide-inbox"
        class="state-block__icon"
      />
      <h2 class="state-block__title">
        {{ title }}
      </h2>
      <p class="state-block__description">
        {{ description }}
      </p>
      <slot />
    </div>
  </section>
</template>
