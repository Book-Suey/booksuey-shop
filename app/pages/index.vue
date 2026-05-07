<script setup lang="ts">
definePageMeta({
  middleware: 'vendor-auth'
})

const balanceCards = [
  {
    label: 'Available balance',
    value: '$1,284.36',
    note: 'Ready to request for payout',
    tone: 'portal-card--accent'
  },
  {
    label: 'Pending balance',
    value: '$412.90',
    note: 'Recently imported sales awaiting settlement',
    tone: 'portal-card--soft'
  },
  {
    label: 'Paid this year',
    value: '$3,976.18',
    note: 'Includes all completed PayPal and Venmo disbursements',
    tone: 'portal-card--warm'
  }
]

const salesRows = [
  {
    title: 'Used fiction batch',
    soldAt: 'Apr 11, 2026',
    gross: '$78.00',
    commission: '$27.30',
    net: '$50.70'
  },
  {
    title: 'Poetry and small press titles',
    soldAt: 'Apr 07, 2026',
    gross: '$61.50',
    commission: '$21.53',
    net: '$39.97'
  },
  {
    title: 'Art book consignment lot',
    soldAt: 'Mar 29, 2026',
    gross: '$104.00',
    commission: '$36.40',
    net: '$67.60'
  }
]

const ledgerRows = [
  {
    type: 'Quarterly import credit',
    reference: 'Batch Q1-2026',
    date: 'Apr 15, 2026',
    amount: '+$158.27',
    status: 'available'
  },
  {
    type: 'Payout request reserved',
    reference: 'Request #PR-1093',
    date: 'Apr 12, 2026',
    amount: '-$250.00',
    status: 'reserved'
  },
  {
    type: 'Venmo disbursement completed',
    reference: 'Disbursement #VD-774',
    date: 'Apr 13, 2026',
    amount: '-$250.00',
    status: 'paid'
  }
]

const payoutRows = [
  {
    id: 'PR-1108',
    method: 'PayPal',
    requestedAt: 'Apr 22, 2026',
    amount: '$320.00',
    status: 'Under review'
  },
  {
    id: 'PR-1093',
    method: 'Venmo',
    requestedAt: 'Apr 12, 2026',
    amount: '$250.00',
    status: 'Paid'
  },
  {
    id: 'PR-1061',
    method: 'PayPal',
    requestedAt: 'Mar 18, 2026',
    amount: '$410.00',
    status: 'Rejected'
  }
]
</script>

<template>
  <div class="portal-shell">
    <section
      id="overview"
      class="portal-hero"
    >
      <div>
        <p class="portal-kicker">
          Vendor self-service portal
        </p>
        <h1 class="portal-title">
          See every sale, every ledger movement, and every payout in one place.
        </h1>
        <p class="portal-copy">
          This is the Book Suey vendor dashboard envisioned from the spec:
          balance transparency up front, recent sales and ledger traceability in
          the middle, and payout actions and history anchored on the right.
        </p>

        <div class="portal-actions">
          <button
            class="portal-button portal-button--primary"
            type="button"
          >
            Request payout
          </button>
          <button
            class="portal-button portal-button--secondary"
            type="button"
          >
            Download quarterly summary
          </button>
        </div>
      </div>

      <aside class="portal-highlight">
        <p class="portal-highlight__eyebrow">
          Current payout window
        </p>
        <h2>$1,284.36 available now</h2>
        <p>
          Your available balance reflects settled sales only. Pending imports
          and open payout reservations stay separated so the number is
          trustworthy.
        </p>

        <dl class="portal-highlight__metrics">
          <div>
            <dt>Last import</dt>
            <dd>Q1 2026 posted Apr 15</dd>
          </div>
          <div>
            <dt>Preferred method</dt>
            <dd>Venmo</dd>
          </div>
          <div>
            <dt>Open requests</dt>
            <dd>1 under review</dd>
          </div>
        </dl>
      </aside>
    </section>

    <section class="portal-grid portal-grid--cards">
      <article
        v-for="card in balanceCards"
        :key="card.label"
        class="portal-card"
        :class="card.tone"
      >
        <p class="portal-card__label">
          {{ card.label }}
        </p>
        <p class="portal-card__value">
          {{ card.value }}
        </p>
        <p class="portal-card__note">
          {{ card.note }}
        </p>
      </article>
    </section>

    <section class="portal-grid portal-grid--main">
      <article
        id="sales"
        class="portal-panel portal-panel--wide"
      >
        <div class="portal-panel__header">
          <div>
            <p class="portal-panel__eyebrow">
              Recent sales
            </p>
            <h2>Imported sales activity</h2>
          </div>

          <span class="portal-chip">Quarterly import driven</span>
        </div>

        <div class="portal-table">
          <div class="portal-table__head">
            <span>Batch</span>
            <span>Sold at</span>
            <span>Gross</span>
            <span>Commission</span>
            <span>Net</span>
          </div>

          <div
            v-for="row in salesRows"
            :key="`${row.title}-${row.soldAt}`"
            class="portal-table__row"
          >
            <span>{{ row.title }}</span>
            <span>{{ row.soldAt }}</span>
            <span>{{ row.gross }}</span>
            <span>{{ row.commission }}</span>
            <span class="text-highlighted">{{ row.net }}</span>
          </div>
        </div>
      </article>

      <article
        id="payouts"
        class="portal-panel"
      >
        <div class="portal-panel__header">
          <div>
            <p class="portal-panel__eyebrow">
              Payout request
            </p>
            <h2>Request funds</h2>
          </div>

          <span class="portal-chip portal-chip--accent">PayPal or Venmo</span>
        </div>

        <form class="portal-form">
          <label>
            <span>Amount</span>
            <input
              type="text"
              value="$320.00"
              readonly
            >
          </label>

          <label>
            <span>Method</span>
            <select>
              <option>Venmo</option>
              <option>PayPal</option>
            </select>
          </label>

          <label>
            <span>Vendor note</span>
            <textarea
              rows="4"
              readonly
            >
Requesting partial payout after Q1 import clears. Leave remainder on account.</textarea>
          </label>

          <button
            class="portal-button portal-button--primary"
            type="button"
          >
            Submit payout request
          </button>
        </form>
      </article>
    </section>

    <section class="portal-grid portal-grid--main">
      <article
        id="ledger"
        class="portal-panel portal-panel--wide"
      >
        <div class="portal-panel__header">
          <div>
            <p class="portal-panel__eyebrow">
              Ledger transparency
            </p>
            <h2>Trace every balance movement</h2>
          </div>

          <span class="portal-chip">Append-only ledger</span>
        </div>

        <div class="portal-ledger">
          <div
            v-for="row in ledgerRows"
            :key="`${row.type}-${row.date}`"
            class="portal-ledger__row"
          >
            <div>
              <p class="portal-ledger__title">
                {{ row.type }}
              </p>
              <p class="portal-ledger__reference">
                {{ row.reference }}
              </p>
            </div>

            <p class="portal-ledger__date">
              {{ row.date }}
            </p>
            <p class="portal-ledger__amount">
              {{ row.amount }}
            </p>
            <span class="portal-status">{{ row.status }}</span>
          </div>
        </div>
      </article>

      <article class="portal-panel">
        <div class="portal-panel__header">
          <div>
            <p class="portal-panel__eyebrow">
              Payout history
            </p>
            <h2>Latest requests</h2>
          </div>
        </div>

        <div class="portal-stack">
          <div
            v-for="row in payoutRows"
            :key="row.id"
            class="portal-history"
          >
            <div>
              <p class="portal-history__id">
                {{ row.id }}
              </p>
              <p class="portal-history__meta">
                {{ row.method }} • {{ row.requestedAt }}
              </p>
            </div>

            <div class="portal-history__right">
              <strong>{{ row.amount }}</strong>
              <span class="portal-status">{{ row.status }}</span>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.portal-shell {
  margin: 0 auto;
  max-width: 1320px;
  padding: 2rem 1rem 4rem;
}

.portal-hero {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  align-items: stretch;
  margin-bottom: 1.25rem;
}

.portal-kicker,
.portal-panel__eyebrow,
.portal-highlight__eyebrow {
  margin: 0 0 0.75rem;
  color: var(--portal-accent);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.portal-title {
  max-width: 11ch;
  margin: 0;
  font-size: clamp(2.8rem, 6vw, 5rem);
  line-height: 0.92;
  font-weight: 800;
  letter-spacing: -0.06em;
  text-transform: uppercase;
}

.portal-copy {
  max-width: 65ch;
  margin: 1rem 0 0;
  color: var(--portal-ink-soft);
  font-size: 1rem;
  line-height: 1.8;
}

.portal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-top: 1.75rem;
}

.portal-button {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 2px solid var(--portal-line);
  border-radius: 0;
  padding: 0.95rem 1.3rem;
  font: inherit;
  letter-spacing: 0.08em;
  font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
  --portal-button-glow: rgba(255, 241, 74, 0.78);
  transition:
    box-shadow 180ms ease,
    color 180ms ease,
    background-color 180ms ease,
    transform 120ms ease;
}

.portal-button::before {
  content: "";
  position: absolute;
  inset: -2px;
  z-index: -1;
  background: linear-gradient(
    90deg,
    transparent 0%,
    transparent 26%,
    rgba(255, 255, 255, 0.16) 38%,
    var(--portal-button-glow) 50%,
    rgba(255, 255, 255, 0.18) 62%,
    transparent 74%,
    transparent 100%
  );
  transform: translateX(-115%);
  transition: transform 380ms ease;
  pointer-events: none;
}

.portal-button:hover::before,
.portal-button:focus-visible::before {
  transform: translateX(115%);
}

.portal-button:hover,
.portal-button:focus-visible {
  outline: none;
}

.portal-button:active {
  transform: translate(4px, 4px);
}

.portal-button--primary {
  background: var(--portal-night);
  color: var(--portal-paper);
  box-shadow: 4px 4px 0 0 var(--portal-solar);
}

.portal-button--primary:hover,
.portal-button--primary:focus-visible {
  background: #1d4a38;
  box-shadow: 6px 6px 0 0 var(--portal-clay);
}

.portal-button--primary:active {
  box-shadow: 0 0 0 0 var(--portal-clay);
}

.portal-button--secondary {
  background: var(--portal-surface-strong);
  color: var(--portal-ink);
  box-shadow: 4px 4px 0 0 var(--portal-accent-soft);
  --portal-button-glow: rgba(0, 184, 107, 0.34);
}

.portal-button--secondary:hover,
.portal-button--secondary:focus-visible {
  background: #d8ff8a;
  box-shadow: 6px 6px 0 0 var(--portal-accent);
}

.portal-button--secondary:active {
  box-shadow: 0 0 0 0 var(--portal-accent);
}

.portal-highlight,
.portal-card,
.portal-panel {
  position: relative;
  border: 2px solid var(--portal-line);
  background: var(--portal-surface-strong);
  border-radius: 0;
  box-shadow: 7px 7px 0 0 rgba(18, 32, 23, 0.14);
}

.portal-highlight::before,
.portal-card::before,
.portal-panel::before {
  content: "";
  position: absolute;
  inset: 0.6rem;
  border: 1px solid rgba(18, 32, 23, 0.18);
  pointer-events: none;
}

.portal-highlight {
  padding: 1.5rem;
  background: var(--portal-night);
  color: var(--portal-paper);
  box-shadow: 7px 7px 0 0 rgba(237, 106, 44, 0.36);
}

.portal-highlight h2 {
  margin: 0;
  font-size: clamp(2rem, 5vw, 3rem);
  line-height: 1;
  text-transform: uppercase;
}

.portal-highlight p {
  margin: 1rem 0 0;
  color: rgba(251, 247, 238, 0.78);
  line-height: 1.7;
}

.portal-highlight__metrics {
  display: grid;
  gap: 1rem;
  margin: 1.5rem 0 0;
}

.portal-highlight__metrics div {
  padding-top: 1rem;
  border-top: 1px solid rgba(251, 247, 238, 0.24);
}

.portal-highlight__metrics dt {
  color: rgba(251, 247, 238, 0.58);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  text-transform: uppercase;
}

.portal-highlight__metrics dd {
  margin: 0.25rem 0 0;
  font-weight: 600;
}

.portal-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.portal-grid--cards {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.portal-grid--main {
  grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.9fr);
}

.portal-card,
.portal-panel {
  padding: 1.3rem;
}

.portal-card__label,
.portal-card__note {
  margin: 0;
}

.portal-card__label {
  color: var(--portal-ink-soft);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.portal-card__value {
  margin: 0.75rem 0 0.5rem;
  font-size: clamp(1.8rem, 4vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  text-transform: uppercase;
}

.portal-card__note {
  color: var(--portal-ink-soft);
  line-height: 1.6;
}

.portal-card--accent {
  background: var(--portal-accent-soft);
}

.portal-card--soft {
  background: #a6ffe4;
}

.portal-card--warm {
  background: #ffbf5a;
}

.portal-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.portal-panel__header h2 {
  margin: 0;
  font-size: 1.35rem;
  text-transform: uppercase;
}

.portal-chip,
.portal-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 2px solid currentColor;
  border-radius: 0;
  padding: 0.4rem 0.7rem;
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.portal-chip {
  background: var(--portal-paper);
  color: var(--portal-ink-soft);
}

.portal-chip--accent,
.portal-status {
  background: var(--portal-accent-soft);
  color: var(--portal-accent);
}

.portal-table {
  display: grid;
  gap: 0.75rem;
}

.portal-table__head,
.portal-table__row {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1.7fr 0.9fr 0.7fr 0.8fr 0.7fr;
  align-items: center;
}

.portal-table__head {
  color: var(--portal-ink-soft);
  font-family: var(--font-mono);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.portal-table__row {
  padding: 1rem;
  border: 2px solid var(--portal-line);
  background: var(--portal-paper);
}

.portal-form {
  display: grid;
  gap: 1rem;
}

.portal-form label {
  display: grid;
  gap: 0.45rem;
}

.portal-form span {
  color: var(--portal-ink-soft);
  font-family: var(--font-mono);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.portal-form input,
.portal-form select,
.portal-form textarea {
  width: 100%;
  border: 2px solid var(--portal-line);
  border-radius: 0;
  background: var(--portal-paper);
  padding: 0.9rem 1rem;
  color: inherit;
  font: inherit;
}

.portal-form textarea {
  resize: none;
}

.portal-ledger,
.portal-stack {
  display: grid;
  gap: 0.85rem;
}

.portal-ledger__row,
.portal-history {
  display: grid;
  gap: 0.75rem;
  align-items: center;
  padding: 1rem;
  border: 2px solid var(--portal-line);
  background: var(--portal-paper);
}

.portal-ledger__row {
  grid-template-columns: minmax(0, 1.3fr) auto auto auto;
}

.portal-ledger__title,
.portal-history__id {
  margin: 0;
  font-weight: 700;
}

.portal-ledger__reference,
.portal-ledger__date,
.portal-history__meta {
  margin: 0.2rem 0 0;
  color: var(--portal-ink-soft);
  font-size: 0.9rem;
}

.portal-ledger__amount {
  font-weight: 700;
}

.portal-history {
  grid-template-columns: minmax(0, 1fr) auto;
}

.portal-history__right {
  display: grid;
  justify-items: end;
  gap: 0.35rem;
}

@media (max-width: 1024px) {
  .portal-hero,
  .portal-grid--main,
  .portal-grid--cards {
    grid-template-columns: 1fr;
  }

  .portal-title {
    max-width: 100%;
  }
}

@media (max-width: 720px) {
  .portal-shell {
    padding-inline: 0.75rem;
  }

  .portal-highlight,
  .portal-card,
  .portal-panel,
  .portal-button {
    box-shadow: none;
  }

  .portal-panel__header,
  .portal-table__head,
  .portal-table__row,
  .portal-ledger__row,
  .portal-history {
    grid-template-columns: 1fr;
  }

  .portal-table__head {
    display: none;
  }

  .portal-table__row,
  .portal-ledger__row,
  .portal-history {
    gap: 0.35rem;
  }

  .portal-history__right {
    justify-items: start;
  }
}
</style>
