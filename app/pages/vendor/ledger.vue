<script setup lang="ts">
definePageMeta({
  middleware: 'vendor-auth',
  layout: 'vendor'
})
await navigateTo('/vendor/balance')
</script>

<template>
  <AppLoadingState
    title="Redirecting"
    description="Opening your balance and ledger view."
  />
</template>
