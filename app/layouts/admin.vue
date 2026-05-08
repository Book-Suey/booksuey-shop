<script setup lang="ts">
const adminAuth = useAdminAuth()
const isLoggingOut = ref(false)

const adminNavMenuUi = {
  content:
    'min-w-56 rounded-none border-2 border-[var(--portal-line)] bg-[var(--portal-paper)] p-1 shadow-none',
  item: 'w-full rounded-none border-2 border-transparent px-[0.85rem] py-[0.6rem] text-left font-mono text-[0.8rem] font-semibold uppercase tracking-[0.1em] !text-[var(--portal-ink-soft)] before:!bg-transparent !transition-none before:!transition-none data-[highlighted]:border-[var(--portal-line)] data-[highlighted]:!bg-[var(--portal-accent-soft)] data-[highlighted]:!text-[var(--portal-ink)] data-[highlighted]:before:!bg-transparent',
  itemLabel: 'truncate'
}

function createAdminMenuItem(label: string, to: string) {
  return {
    label,
    onSelect: () => {
      void navigateTo(to)
    }
  }
}

const vendorMenuItems = [
  createAdminMenuItem('Vendor Accounts', '/admin/vendors'),
  createAdminMenuItem(
    'Approved Vendor List',
    '/admin/vendors/approved-vendors'
  ),
  createAdminMenuItem(
    'Verified Non-Vendor Sources',
    '/admin/vendors/non-vendor-sources'
  )
]

const payoutMenuItems = [
  createAdminMenuItem('Manage Payouts', '/admin/payout-requests'),
  createAdminMenuItem(
    'Payout Failures',
    '/admin/payout-requests/payout-failures'
  )
]

const adminMenuItems = [
  createAdminMenuItem('Import Sales', '/admin/imports'),
  createAdminMenuItem('Audit', '/admin/audit')
]

onMounted(async () => {
  await adminAuth.ensureInitialized()
})

async function handleLogout(): Promise<void> {
  isLoggingOut.value = true
  await adminAuth.logout()
  isLoggingOut.value = false
  await navigateTo('/login')
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

          <UDropdownMenu
            v-slot="{ open }"
            :items="vendorMenuItems"
            :modal="false"
            :content="{ align: 'end' }"
            :ui="adminNavMenuUi"
          >
            <button
              type="button"
              class="app-nav__link app-nav__button app-nav__menu-trigger"
              :aria-expanded="open"
              aria-label="Open vendor navigation menu"
            >
              <span>Vendors</span>
              <UIcon
                name="i-lucide-chevron-down"
                class="app-nav__chevron"
                :class="{ 'app-nav__chevron--open': open }"
              />
            </button>
          </UDropdownMenu>

          <UDropdownMenu
            v-slot="{ open }"
            :items="payoutMenuItems"
            :modal="false"
            :content="{ align: 'end' }"
            :ui="adminNavMenuUi"
          >
            <button
              type="button"
              class="app-nav__link app-nav__button app-nav__menu-trigger"
              :aria-expanded="open"
              aria-label="Open payout navigation menu"
            >
              <span>Payouts</span>
              <UIcon
                name="i-lucide-chevron-down"
                class="app-nav__chevron"
                :class="{ 'app-nav__chevron--open': open }"
              />
            </button>
          </UDropdownMenu>

          <UDropdownMenu
            v-slot="{ open }"
            :items="adminMenuItems"
            :modal="false"
            :content="{ align: 'end' }"
            :ui="adminNavMenuUi"
          >
            <button
              type="button"
              class="app-nav__link app-nav__button app-nav__menu-trigger"
              :aria-expanded="open"
              aria-label="Open admin navigation menu"
            >
              <span>Admin</span>
              <UIcon
                name="i-lucide-chevron-down"
                class="app-nav__chevron"
                :class="{ 'app-nav__chevron--open': open }"
              />
            </button>
          </UDropdownMenu>

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
      <div class="app-main__inner">
        <slot />
      </div>
    </UMain>

    <UFooter class="app-footer">
      <template #left>
        <p class="app-footer__copy">
          Book Suey Admin Console • © {{ new Date().getFullYear() }}
        </p>
      </template>

      <template #right>
        <p class="app-footer__copy app-footer__copy--muted">
          Vendors, imports, payouts, and operational visibility in one place.
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
