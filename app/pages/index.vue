<script setup lang="ts">
const auth = useVendorAuth();
const hasVendorSession = ref(false);

onMounted(async () => {
  await auth.ensureInitialized();
  hasVendorSession.value = !!auth.token.value;
});
</script>

<template>
  <section class="home-page">
    <header class="home-hero">
      <h1 class="home-hero__title">
        Keep your bookstore partnership clear and predictable.
      </h1>
      <p class="home-hero__copy">
        Vendors track sales, balances, and payouts in one dashboard while admins
        run imports, reviews, and audit trails from the same platform.
      </p>

      <div class="home-hero__actions">
        <NuxtLink
          v-if="hasVendorSession"
          to="/vendor"
          class="portal-button portal-button--primary"
        >
          Go to vendor dashboard
        </NuxtLink>
        <NuxtLink
          v-else
          to="/login"
          class="portal-button portal-button--primary"
        >
          Vendor sign in
        </NuxtLink>
        <NuxtLink
          v-if="!hasVendorSession"
          to="/register"
          class="portal-button portal-button--secondary"
        >
          Create account
        </NuxtLink>
        <NuxtLink to="/admin" class="portal-button portal-button--secondary">
          Admin console
        </NuxtLink>
      </div>
    </header>

    <section class="home-features">
      <article class="home-feature-card">
        <p class="home-feature-card__eyebrow">For Vendors</p>
        <h2>Financial visibility</h2>
        <p>
          See imported sales, ledger activity, balances, and payout request
          status without waiting on manual reports.
        </p>
      </article>

      <article class="home-feature-card">
        <p class="home-feature-card__eyebrow">For Operations</p>
        <h2>Reliable workflows</h2>
        <p>
          Manage imports, payout reviews, exception handling, and vendor records
          in a focused admin workspace.
        </p>
      </article>

      <article class="home-feature-card">
        <p class="home-feature-card__eyebrow">For Compliance</p>
        <h2>Audit-ready trail</h2>
        <p>
          Track key events, disbursement decisions, and source reconciliation to
          support transparent financial operations.
        </p>
      </article>
    </section>
  </section>
</template>
