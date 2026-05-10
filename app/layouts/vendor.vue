<script setup lang="ts">
const auth = useVendorAuth()
const isLoggingOut = ref(false)
const hasHydrated = ref(false)
const vendorDisplayName = computed(() => {
  if (!hasHydrated.value) {
    return 'Account'
  }

  return auth.vendor.value?.displayName || 'Account'
})

const vendorNavMenuUi = {
  content:
    'min-w-56 rounded-none border-2 border-[var(--portal-line)] bg-[var(--portal-paper)] p-1 shadow-none',
  item: 'w-full rounded-none border-2 border-transparent px-[0.85rem] py-[0.6rem] text-left font-mono text-[0.8rem] font-semibold uppercase tracking-[0.1em] !text-[var(--portal-ink-soft)] before:!bg-transparent !transition-none before:!transition-none data-[highlighted]:border-[var(--portal-line)] data-[highlighted]:!bg-[var(--portal-accent-soft)] data-[highlighted]:!text-[var(--portal-ink)] data-[highlighted]:before:!bg-transparent',
  itemLabel: 'truncate'
}

const accountMenuItems = computed(() => [
  {
    label: 'Profile',
    onSelect: () => {
      void navigateTo('/vendor/profile')
    }
  },
  {
    label: isLoggingOut.value ? 'Signing out...' : 'Logout',
    disabled: isLoggingOut.value,
    onSelect: () => {
      void handleLogout()
    }
  }
])

onMounted(async () => {
  await auth.ensureInitialized()
  hasHydrated.value = true
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
          to="/vendor"
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

          <UDropdownMenu
            v-slot="{ open }"
            :items="accountMenuItems"
            :modal="false"
            :content="{ align: 'end' }"
            :ui="vendorNavMenuUi"
          >
            <button
              type="button"
              class="app-nav__link app-nav__button app-nav__menu-trigger"
              :aria-expanded="open"
              aria-label="Open vendor account menu"
            >
              <span>{{ vendorDisplayName }}</span>
              <UIcon
                name="i-lucide-chevron-down"
                class="app-nav__chevron"
                :class="{ 'app-nav__chevron--open': open }"
              />
            </button>
          </UDropdownMenu>
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
