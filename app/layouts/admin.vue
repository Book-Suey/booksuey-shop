<script setup lang="ts">
const adminAuth = useAdminAuth()
const isLoggingOut = ref(false)

onMounted(async () => {
  await adminAuth.ensureInitialized()
})

async function handleLogout(): Promise<void> {
  isLoggingOut.value = true
  await adminAuth.logout()
  isLoggingOut.value = false
  await navigateTo('/admin/login')
}
</script>

<template>
  <UApp class="app-shell app-shell--admin">
    <UHeader
      :toggle="false"
      class="app-header"
    >
      <template #left>
        <NuxtLink
          to="/admin"
          class="app-brand"
        >
          <img
            src="/LogoIcon.svg"
            alt="Book Suey logo"
            class="app-brand__mark"
          >
          <span class="app-brand__text">
            <span class="app-brand__name">Book Suey</span>
            <span class="app-brand__meta">Admin Console</span>
          </span>
        </NuxtLink>
      </template>

      <template #right>
        <nav class="app-nav">
          <NuxtLink
            to="/admin"
            class="app-nav__link"
          >Home</NuxtLink>
          <NuxtLink
            to="/admin/approved-vendors"
            class="app-nav__link"
          >Approved Vendors</NuxtLink>
          <NuxtLink
            to="/admin/vendors"
            class="app-nav__link"
          >Vendors</NuxtLink>
          <NuxtLink
            to="/admin/imports"
            class="app-nav__link"
          >Imports</NuxtLink>
          <NuxtLink
            to="/admin/payout-requests"
            class="app-nav__link"
          >Payouts</NuxtLink>
          <NuxtLink
            to="/admin/audit"
            class="app-nav__link"
          >Audit</NuxtLink>
          <NuxtLink
            to="/admin/payout-failures"
            class="app-nav__link"
          >Payout Failures</NuxtLink>
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

    <UMain class="app-main app-main--admin">
      <slot />
    </UMain>
  </UApp>
</template>
