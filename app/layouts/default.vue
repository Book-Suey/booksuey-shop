<script setup lang="ts">
const auth = useVendorAuth()
const isLoggingOut = ref(false)

onMounted(async () => {
  await auth.ensureInitialized()
})

const isAuthenticated = computed(() => !!auth.token.value)

async function handleLogout(): Promise<void> {
  isLoggingOut.value = true
  await auth.logout()
  isLoggingOut.value = false
  await navigateTo('/login')
}
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
          <img
            src="/LogoIcon.svg"
            alt="Book Suey logo"
            class="app-brand__mark"
          >
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
              to="/vendor"
              class="app-nav__link"
            >Overview</NuxtLink>
            <NuxtLink
              to="/vendor/sales"
              class="app-nav__link"
            >Sales</NuxtLink>
            <NuxtLink
              to="/vendor/balance"
              class="app-nav__link"
            >Balance</NuxtLink>
            <NuxtLink
              to="/vendor/payouts"
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
      <div class="app-main__inner">
        <slot />
      </div>
    </UMain>

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
