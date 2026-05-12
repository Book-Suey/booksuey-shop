<script setup lang="ts">
definePageMeta({
  middleware: 'admin-auth',
  layout: 'admin'
})
</script>

<template>
  <section class="admin-page guide-page">
    <header class="admin-page__header vendor-panel guide-hero">
      <h1 class="auth-title">
        Admin User Guide
      </h1>
      <p class="guide-stamp">
        Last updated: May 11, 2026
      </p>
    </header>

    <div class="guide-layout">
      <aside class="vendor-panel guide-toc">
        <h2>Contents</h2>
        <ul>
          <li><a href="#approved">Approved Vendor List</a></li>
          <li><a href="#non-vendor">Non-Vendor Sources</a></li>
          <li><a href="#vendors">Vendor Accounts</a></li>
          <li><a href="#imports">Sales Imports</a></li>
          <li><a href="#payouts">Payout Queue</a></li>
          <li><a href="#disbursements">Disbursement Processing</a></li>
          <li><a href="#failures">Payout Failures</a></li>
          <li><a href="#audit">Audit Trail</a></li>
          <li><a href="#status">Status Reference</a></li>
          <li><a href="#troubleshooting">Troubleshooting</a></li>
        </ul>
      </aside>

      <div class="guide-content">
        <article
          id="approved"
          class="vendor-panel"
        >
          <h2>Approved Vendor List</h2>
          <p>
            Routes:
            <NuxtLink to="/admin/vendors/approved-vendors">/admin/vendors/approved-vendors</NuxtLink>,
            <NuxtLink to="/admin/vendors/approved-vendors/new">/admin/vendors/approved-vendors/new</NuxtLink>
          </p>
          <ul>
            <li>Create approved vendors with Basil ID and contact details.</li>
            <li>Edit records and monitor linked/unlinked state.</li>
            <li>
              This is the most important list before running any imports, as the
              approved vendor names here will link to the "Source" column in
              ReportSalesDetail csv files that are imported.
            </li>
            <li>
              The email here will need to match the email that the vendor uses
              to create and account or login. If you choose to send them an
              invitation directly, you can be more certain that they will sign
              up with the correct email.
            </li>
          </ul>
        </article>

        <article
          id="non-vendor"
          class="vendor-panel"
        >
          <h2>Verified Non-Vendor Sources</h2>
          <p>
            Route:
            <NuxtLink to="/admin/vendors/non-vendor-sources">/admin/vendors/non-vendor-sources</NuxtLink>
          </p>
          <ul>
            <li>Manage known non-vendor source mappings.</li>
            <li>
              This is where any accounts that are either publisher accounts,
              member-owner accounts, or customers with actual customer credit
              are added so that they can be properly rejected for import without
              being flagged as errors. After each import you can identify these
              from the unmapped sources errors. The name is simply the First
              Name Last Name as they exist in Basil.
            </li>
          </ul>
        </article>

        <article
          id="vendors"
          class="vendor-panel"
        >
          <h2>Vendor Accounts</h2>
          <p>
            Routes: <NuxtLink to="/admin/vendors">/admin/vendors</NuxtLink>,
            <NuxtLink to="/admin/vendors/new">/admin/vendors/new</NuxtLink>
          </p>
          <ul>
            <li>Create and maintain vendor accounts.</li>
            <li>Set active or inactive status.</li>
            <li>Invite from approved vendor records when unlinked.</li>
          </ul>
        </article>

        <article
          id="imports"
          class="vendor-panel"
        >
          <h2>Sales Imports</h2>
          <p>
            Routes:
            <NuxtLink to="/admin/imports/upload">/admin/imports/upload</NuxtLink>,
            <NuxtLink to="/admin/imports">/admin/imports</NuxtLink>
          </p>
          <ol>
            <li>Upload CSV and set source period.</li>
            <li>Review accepted/rejected counts and warnings.</li>
            <li>Inspect batch detail for unmapped sources and duplicates.</li>
          </ol>
          <p class="panel-copy">
            Statuses: completed, failed, flagged (rejected rows).
          </p>
        </article>

        <article
          id="payouts"
          class="vendor-panel"
        >
          <h2>Payout Queue</h2>
          <p>
            Route:
            <NuxtLink to="/admin/payout-requests">/admin/payout-requests</NuxtLink>
          </p>
          <ol>
            <li>Review queue metrics and open request details.</li>
            <li>Approve/reject with review note or rejection reason.</li>
            <li>Disburse only after request status is approved.</li>
          </ol>
          <p class="panel-copy">
            This is where you can see any requests to be paid. Each one will
            need to be handled individually. It is a multi step process in order
            to keep database items safe a consistent while providing some
            guardrails for payment duplication or accidental errors. Generally
            speaking you should move from approval straight to disbursement.
            Potential statuses: requested, approved, disbursing, paid, failed,
            rejected.
          </p>
        </article>

        <article
          id="disbursements"
          class="vendor-panel"
        >
          <h2>Disbursement Processing</h2>
          <p>
            Route:
            <NuxtLink to="/admin/disbursements/new">/admin/disbursements/new</NuxtLink>
            (with payoutRequestId query)
          </p>
          <ul>
            <li>
              PayPal and Venmo disbursements are initiated from this page. The
              option will only be available for requests that have been approved
              and have a valid payout method on file. If you are unable to move
              forward with a disbursement, it might be because the vendor has
              not selected a preferred payout method or because their payout
              method is missing required information. You can click into the
              vendor account from the payout request details to review and
              update payout method information as needed.
            </li>
            <li>
              Once the disbursement is initiated, it will take a minute or so.
              You can monitor the status with the link to check on the status
              until completion if you need to wait for final confirmation.
            </li>
          </ul>
        </article>

        <article
          id="failures"
          class="vendor-panel"
        >
          <h2>Payout Failures</h2>
          <p>
            Route:
            <NuxtLink to="/admin/payout-requests/payout-failures">/admin/payout-requests/payout-failures</NuxtLink>
          </p>
          <ul>
            <li>Review failed disbursements and provider messages.</li>
            <li>Re-check provider status and export CSV for escalation.</li>
          </ul>
        </article>

        <article
          id="audit"
          class="vendor-panel"
        >
          <h2>Audit Trail</h2>
          <p>Route: <NuxtLink to="/admin/audit">/admin/audit</NuxtLink></p>
          <ul>
            <li>Filter by action, entity, actor role, and date range.</li>
            <li>Inspect before/after snapshots for investigations.</li>
          </ul>
        </article>

        <article
          id="status"
          class="vendor-panel"
        >
          <h2>Status Reference</h2>
          <ul>
            <li>Imports: completed, failed, flagged</li>
            <li>Vendors: active, inactive</li>
            <li>
              Payouts: requested, approved, disbursing, paid, failed, rejected
            </li>
            <li>Failure reconciliation: failed, pending restore, restored</li>
          </ul>
        </article>

        <article
          id="troubleshooting"
          class="vendor-panel"
        >
          <h2>Checklist</h2>
          <ol>
            <li>
              Imports failing: inspect batch details and fix mappings first.
            </li>
            <li>
              Payout blocked: verify approved status and payout destination.
            </li>
            <li>
              Persistent failures: use payout failures page and export CSV.
            </li>
            <li>Data mismatch: confirm event sequence in audit logs.</li>
          </ol>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.guide-page {
  display: grid;
  gap: 1rem;
}

.guide-hero {
  background: linear-gradient(135deg, #fff6e8, #fffaf3 45%, #fbe7d7);
}

.guide-kicker {
  margin: 0;
  color: var(--portal-ink-soft);
  font-size: 0.78rem;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  font-weight: 700;
}

.guide-stamp {
  margin: 0;
  font-size: 0.85rem;
  color: var(--portal-ink-soft);
}

.guide-layout {
  display: grid;
  gap: 1rem;
  grid-template-columns: 280px minmax(0, 1fr);
}

.guide-toc {
  position: sticky;
  top: 0.8rem;
  align-self: start;
}

.guide-toc ul {
  margin: 0;
  padding-left: 1rem;
}

.guide-toc li {
  margin: 0;
  padding: 0.4rem 0;
}

.guide-toc li + li {
  border-top: 1px solid
    color-mix(in srgb, var(--portal-divider) 45%, transparent);
}

.guide-content {
  display: grid;
  gap: 0.9rem;
}

.guide-content ul,
.guide-content ol {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
}

.guide-content li {
  margin: 0;
  padding: 0.45rem 0;
}

.guide-content li + li {
  border-top: 1px solid
    color-mix(in srgb, var(--portal-divider) 50%, transparent);
}

.guide-grid {
  display: grid;
  gap: 0.8rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 960px) {
  .guide-layout {
    grid-template-columns: 1fr;
  }

  .guide-toc {
    position: static;
  }

  .guide-grid {
    grid-template-columns: 1fr;
  }
}
</style>
