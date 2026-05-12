<script setup lang="ts">
const auth = useVendorAuth()
const isLoggingOut = ref(false)
const isMobileMenuOpen = ref(false)

onMounted(async () => {
  await auth.ensureInitialized()
})

const isAuthenticated = computed(() => !!auth.token.value)
const headerUi = {
  container: 'app-header__container'
}

async function handleLogout(): Promise<void> {
  isLoggingOut.value = true
  await auth.logout()
  isMobileMenuOpen.value = false
  isLoggingOut.value = false
  await navigateTo('/login')
}

function toggleMobileMenu(): void {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

function closeMobileMenu(): void {
  isMobileMenuOpen.value = false
}
</script>

<template>
  <UApp class="app-shell">
    <UHeader
      :toggle="false"
      class="app-header"
      :ui="headerUi"
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
        <button
          type="button"
          class="app-menu-toggle"
          :aria-expanded="isMobileMenuOpen"
          aria-label="Toggle navigation menu"
          @click="toggleMobileMenu"
        >
          <UIcon
            :name="isMobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
            class="app-menu-toggle__icon"
          />
        </button>

        <nav class="app-nav app-nav--desktop">
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

    <div
      v-if="isMobileMenuOpen"
      class="app-mobile-backdrop"
      @click="closeMobileMenu"
    />

    <aside
      class="app-mobile-menu"
      :class="{ 'app-mobile-menu--open': isMobileMenuOpen }"
      aria-label="Mobile navigation"
    >
      <nav class="app-mobile-menu__nav">
        <template v-if="isAuthenticated">
          <NuxtLink
            to="/vendor"
            class="app-mobile-menu__link"
            @click="closeMobileMenu"
          >Overview</NuxtLink>
          <NuxtLink
            to="/vendor/sales"
            class="app-mobile-menu__link"
            @click="closeMobileMenu"
          >Sales</NuxtLink>
          <NuxtLink
            to="/vendor/balance"
            class="app-mobile-menu__link"
            @click="closeMobileMenu"
          >Balance</NuxtLink>
          <NuxtLink
            to="/vendor/payouts"
            class="app-mobile-menu__link"
            @click="closeMobileMenu"
          >Payouts</NuxtLink>
          <button
            type="button"
            class="app-mobile-menu__link app-mobile-menu__button"
            :disabled="isLoggingOut"
            @click="handleLogout"
          >
            {{ isLoggingOut ? "Signing out..." : "Logout" }}
          </button>
        </template>

        <template v-else>
          <NuxtLink
            to="/login"
            class="app-mobile-menu__link"
            @click="closeMobileMenu"
          >Login</NuxtLink>
          <NuxtLink
            to="/register"
            class="app-mobile-menu__link"
            @click="closeMobileMenu"
          >Register</NuxtLink>
        </template>
      </nav>
    </aside>

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
