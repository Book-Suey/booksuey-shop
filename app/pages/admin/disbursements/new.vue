<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})

interface DisbursementResponse {
  disbursement: {
    disbursementId: string
    payoutRequestId: string
    methodType: string
    providerReferenceId: string
    amount: string
    currency: string
    status: string
    disbursedAt: string
  }
}

const route = useRoute()
const router = useRouter()
const auth = useAdminAuth()

const isSubmitting = ref(false)
const submitError = ref<string | null>(null)
const successMessage = ref<string | null>(null)

const payoutRequestId = computed(() => route.query.payoutRequestId as string)

const form = reactive({
  methodType: 'paypal',
  providerReferenceId: ''
})

if (!payoutRequestId.value) {
  onBeforeMount(() => {
    submitError.value
      = 'No payout request specified. Please navigate from a payout detail page.'
  })
}

async function submitDisbursement(): Promise<void> {
  submitError.value = null
  successMessage.value = null

  if (!form.methodType.trim()) {
    submitError.value = 'Select a payment method (PayPal or Venmo).'
    return
  }

  if (!form.providerReferenceId.trim()) {
    submitError.value
      = 'Enter the provider reference ID from the payment gateway.'
    return
  }

  isSubmitting.value = true

  try {
    await auth.ensureInitialized()

    // Generate a simple idempotency key from timestamp and random string
    const idempotencyKey = `disbursement_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const result = await $fetch<DisbursementResponse>(
      '/api/admin/disbursements',
      {
        method: 'POST',
        headers: auth.authHeaders(),
        body: {
          payoutRequestId: payoutRequestId.value,
          methodType: form.methodType.trim(),
          providerReferenceId: form.providerReferenceId.trim(),
          idempotencyKey
        }
      }
    )

    successMessage.value = `Disbursement ${result.disbursement.disbursementId} created successfully.`
    form.methodType = 'paypal'
    form.providerReferenceId = ''

    setTimeout(() => {
      router.push(`/admin/payout-requests/${payoutRequestId.value}`)
    }, 1000)
  } catch (error: unknown) {
    const statusMessage = (error as { statusMessage?: string })?.statusMessage
    submitError.value
      = statusMessage || 'Unable to create disbursement right now.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <section class="admin-page">
    <header class="admin-page__header">
      <p class="auth-kicker">
        Admin payout operations
      </p>
      <h1 class="auth-title">
        Create disbursement
      </h1>
      <p class="auth-copy">
        Execute a payment disbursement for an approved payout request using
        PayPal or Venmo.
      </p>

      <div class="vendor-actions">
        <NuxtLink
          v-if="payoutRequestId"
          :to="`/admin/payout-requests/${payoutRequestId}`"
          class="portal-button portal-button--secondary"
        >
          Back to request
        </NuxtLink>
        <NuxtLink
          to="/admin/payout-requests"
          class="portal-button portal-button--secondary"
        >
          Back to queue
        </NuxtLink>
      </div>
    </header>

    <article class="vendor-panel stack-grid">
      <div>
        <h2>Disbursement details</h2>
        <p class="panel-copy">
          Specify the payment method and provider reference ID from your payment
          gateway.
        </p>
      </div>

      <form
        class="auth-form"
        @submit.prevent="submitDisbursement"
      >
        <label>
          <span>Payment method</span>
          <select
            v-model="form.methodType"
            required
          >
            <option value="paypal">PayPal</option>
            <option value="venmo">Venmo</option>
          </select>
        </label>

        <label>
          <span>Provider reference ID</span>
          <input
            v-model="form.providerReferenceId"
            type="text"
            placeholder="e.g., txn_1A2B3C4D5E6F7G8H9I..."
            required
          >
        </label>

        <p
          v-if="submitError"
          class="auth-error"
        >
          {{ submitError }}
        </p>

        <p
          v-if="successMessage"
          class="auth-success"
        >
          {{ successMessage }}
        </p>

        <button
          type="submit"
          class="portal-button portal-button--primary"
          :disabled="isSubmitting"
        >
          {{
            isSubmitting ? "Creating disbursement..." : "Create disbursement"
          }}
        </button>
      </form>
    </article>
  </section>
</template>
