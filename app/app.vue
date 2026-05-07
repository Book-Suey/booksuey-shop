<script setup>
const auth = useVendorAuth()
const isLoggingOut = ref(false)

onMounted(async () => {
  await auth.ensureInitialized()
})

const isAuthenticated = computed(() => !!auth.token.value)

async function handleLogout() {
  isLoggingOut.value = true
  await auth.logout()
  isLoggingOut.value = false
  await navigateTo('/login')
}

useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en'
  }
})

const title = 'Book Suey Vendor Portal'
const description
  = 'A vendor self-service portal for Book Suey consignors to review sales, track balances, and request payouts.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp class="app-shell">
    <UHeader
      :toggle="false"
      class="app-header"
    >
      <template #left>
        <NuxtLink
          to="/"
          class="app-brand"
        >
          <span class="app-brand__mark">BS</span>
          <span class="app-brand__text">
            <span class="app-brand__name">Book Suey</span>
            <span class="app-brand__meta">Vendor Portal</span>
          </span>
        </NuxtLink>
      </template>

      <template #right>
        <nav class="app-nav">
          <template v-if="isAuthenticated">
            <NuxtLink
              to="/#overview"
              class="app-nav__link"
            >Overview</NuxtLink>
            <NuxtLink
              to="/#sales"
              class="app-nav__link"
            >Sales</NuxtLink>
            <NuxtLink
              to="/#ledger"
              class="app-nav__link"
            >Ledger</NuxtLink>
            <NuxtLink
              to="/#payouts"
              class="app-nav__link"
            >Payouts</NuxtLink>
            <button
              type="button"
              class="app-nav__link app-nav__button"
              :disabled="isLoggingOut"
              @click="handleLogout"
            >
              {{ isLoggingOut ? "Signing out..." : "Logout" }}
            </button>
          </template>

          <template v-else>
            <NuxtLink
              to="/login"
              class="app-nav__link"
            >Login</NuxtLink>
            <NuxtLink
              to="/register"
              class="app-nav__link"
            >Register</NuxtLink>
          </template>
        </nav>
      </template>
    </UHeader>

    <UMain class="app-main">
      <NuxtPage />
    </UMain>

    <USeparator class="app-separator" />

    <UFooter class="app-footer">
      <template #left>
        <p class="app-footer__copy">
          Book Suey Vendor Portal • © {{ new Date().getFullYear() }}
        </p>
      </template>

      <template #right>
        <p class="app-footer__copy app-footer__copy--muted">
          Quarterly sales, balances, and payout history in one place.
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
