<script setup lang="ts">
definePageMeta({
  middleware: "admin-auth",
  layout: "admin",
});

const isSubmitting = ref(false);
const formError = ref<string | null>(null);

const form = reactive({
  legalName: "",
  displayName: "",
  email: "",
  phone: "",
  password: "",
  status: "active" as "active" | "inactive",
  approvedVendorId: "",
});

async function submitNewVendor(): Promise<void> {
  formError.value = null;
  isSubmitting.value = true;

  try {
    const response = await $fetch<{ vendor: { vendorId: string } }>(
      "/api/admin/vendors",
      {
        method: "POST",
        body: {
          legalName: form.legalName,
          displayName: form.displayName,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
          status: form.status,
          approvedVendorId: form.approvedVendorId || undefined,
        },
      },
    );

    await navigateTo(`/admin/vendors/${response.vendor.vendorId}`);
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage;
    formError.value = statusMessage || "Unable to create vendor account.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <h1 class="auth-title">Add vendor account</h1>
      <p class="auth-copy">
        Create a new vendor login profile and optional approved-vendor mapping.
      </p>
    </header>

    <article class="vendor-panel">
      <form class="auth-form" @submit.prevent="submitNewVendor">
        <label>
          <span>Legal name</span>
          <input v-model="form.legalName" required type="text" />
        </label>

        <label>
          <span>Display name</span>
          <input v-model="form.displayName" required type="text" />
        </label>

        <label>
          <span>Email</span>
          <input v-model="form.email" required type="email" />
        </label>

        <label>
          <span>Phone (optional)</span>
          <input v-model="form.phone" type="text" />
        </label>

        <label>
          <span>Password</span>
          <input
            v-model="form.password"
            required
            minlength="8"
            type="password"
          />
        </label>

        <label>
          <span>Status</span>
          <select v-model="form.status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label>
          <span>Approved vendor ID (optional)</span>
          <input v-model="form.approvedVendorId" type="text" />
        </label>

        <p v-if="formError" class="auth-error">
          {{ formError }}
        </p>

        <div class="vendor-actions">
          <button
            type="submit"
            class="portal-button portal-button--primary"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? "Creating..." : "Create vendor" }}
          </button>
          <NuxtLink
            to="/admin/vendors"
            class="portal-button portal-button--secondary"
          >
            Cancel
          </NuxtLink>
        </div>
      </form>
    </article>
  </section>
</template>
