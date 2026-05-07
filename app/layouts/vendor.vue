<script setup lang="ts">
const auth = useVendorAuth()
const isLoggingOut = ref(false)

onMounted(async () => {
  await auth.ensureInitialized()
})

async function handleLogout(): Promise<void> {
  isLoggingOut.value = true
  await auth.logout()
  isLoggingOut.value = false
  await navigateTo('/login')
}
</script>

<template>
  <UApp class="app-shell app-shell--vendor">
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
          <NuxtLink
            to="/"
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
            to="/vendor/ledger"
            class="app-nav__link"
          >Ledger</NuxtLink>
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
        </nav>
      </template>
    </UHeader>

    <UMain class="app-main">
      <slot />
    </UMain>
  </UApp>
</template>
