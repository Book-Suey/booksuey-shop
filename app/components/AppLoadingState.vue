<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  {
    title: 'Loading data',
    description: 'Please wait while we fetch the latest records.'
  }
)
</script>

<template>
  <section class="state-block state-block--loading">
    <div class="state-block__inner">
      <UIcon
        name="i-lucide-loader-2"
        class="state-block__icon state-block__icon--spin"
      />
      <h2 class="state-block__title">
        {{ title }}
      </h2>
      <p class="state-block__description">
        {{ description }}
      </p>
    </div>
  </section>
</template>
