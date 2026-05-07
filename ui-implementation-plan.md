# UI Implementation Plan (MVP-First)

## Status Snapshot

- Last updated: 2026-05-07
- Completed phases:
  - Phase 0: UI foundation
  - Phase 1: Vendor auth UX completion
  - Phase 2: Vendor financial surface
  - Phase 3: Admin auth + shell
  - Phase 4: Admin vendor management
  - Phase 5: Admin sales import operations (including e2e tests)
  - Phase 6: Admin payout operations
  - Phase 7: Admin operational visibility
- Next phases:
  - Phase 8: UX hardening and test expansion

## Working Notes

- The document now tracks implementation state, not just intended scope.
- When resuming work, start with the first unchecked acceptance item in the active phase.
- Update the phase status line and the short progress notes each time a vertical slice lands.

## Objective

Implement the missing admin and vendor UI surfaces in a sequence that unlocks core workflows first, then operational visibility and polish.

## Current State Snapshot

- Implemented vendor pages:
  - [app/pages/login.vue](app/pages/login.vue)
  - [app/pages/register.vue](app/pages/register.vue)
  - [app/pages/forgot-password.vue](app/pages/forgot-password.vue)
  - [app/pages/reset-password.vue](app/pages/reset-password.vue)
  - [app/pages/index.vue](app/pages/index.vue)
  - [app/pages/vendor/sales.vue](app/pages/vendor/sales.vue)
  - [app/pages/vendor/ledger.vue](app/pages/vendor/ledger.vue)
  - [app/pages/vendor/balance.vue](app/pages/vendor/balance.vue)
  - [app/pages/vendor/payouts.vue](app/pages/vendor/payouts.vue)
- Implemented admin pages:
  - [app/pages/admin/login.vue](app/pages/admin/login.vue)
  - [app/pages/admin/index.vue](app/pages/admin/index.vue)
  - [app/pages/admin/approved-vendors.vue](app/pages/admin/approved-vendors.vue)
  - [app/pages/admin/approved-vendors/new.vue](app/pages/admin/approved-vendors/new.vue)
  - [app/pages/admin/approved-vendors/[approvedVendorId].vue](app/pages/admin/approved-vendors/[approvedVendorId].vue)
  - [app/pages/admin/vendors.vue](app/pages/admin/vendors.vue)
  - [app/pages/admin/vendors/new.vue](app/pages/admin/vendors/new.vue)
  - [app/pages/admin/vendors/[vendorId].vue](app/pages/admin/vendors/[vendorId].vue)
  - [app/pages/admin/imports.vue](app/pages/admin/imports.vue)
  - [app/pages/admin/imports/upload.vue](app/pages/admin/imports/upload.vue)
  - [app/pages/admin/imports/[batchId].vue](app/pages/admin/imports/[batchId].vue)
  - [app/pages/admin/payout-requests.vue](app/pages/admin/payout-requests.vue)
  - [app/pages/admin/payout-requests/[payoutId].vue](app/pages/admin/payout-requests/[payoutId].vue)
  - [app/pages/admin/disbursements/new.vue](app/pages/admin/disbursements/new.vue)
  - [app/pages/admin/audit.vue](app/pages/admin/audit.vue)
  - [app/pages/admin/payout-failures.vue](app/pages/admin/payout-failures.vue)
- Existing backend coverage is broad across vendor/admin APIs.
- Biggest remaining UI gap is broader workflow hardening and test coverage expansion.

## Delivery Principles

- Build end-to-end vertical slices (page + API integration + tests) instead of isolated UI shells.
- Prioritize workflows that move money and reduce operational risk.
- Keep route guards strict:
  - Vendor pages behind vendor auth middleware.
  - Admin pages behind admin auth middleware.
- Every data view ships with loading, empty, and error states.

## Phase 0: UI Foundation (Shared)

Status: Complete

Progress notes:

- Shared admin and vendor layouts are in place.
- Loading, empty, error, table, and status badge primitives are already used across vendor and admin pages.

### Scope

- Add app shells/layouts:
  - `vendor` shell with vendor nav.
  - `admin` shell with admin nav.
- Build reusable primitives:
  - table with sortable headers
  - date-range filter
  - status badge
  - pagination controls
  - error/empty/loading blocks
  - confirm modal
  - toast notifications

### Acceptance Criteria

- Shared primitives are used by at least one vendor page and one admin page.
- No page ships with hardcoded placeholder financial data.

## Phase 1: Vendor Auth UX Completion

Status: Complete

Progress notes:

- Reset request and reset completion pages are implemented.
- Vendor auth flows now cover login, registration, reset token validation, and password update UX.

### Pages

1. `/login` (existing, refine)
2. `/register` (existing, refine)
3. `/forgot-password` (new)
4. `/reset-password` (new)

### API Bindings

- POST [server/api/vendor/login.post.ts](server/api/vendor/login.post.ts)
- POST [server/api/vendor/register.post.ts](server/api/vendor/register.post.ts)
- POST [server/api/vendor/reset-password.post.ts](server/api/vendor/reset-password.post.ts)
- GET [server/api/vendor/verify-reset-token.get.ts](server/api/vendor/verify-reset-token.get.ts)
- POST [server/api/vendor/update-password.post.ts](server/api/vendor/update-password.post.ts)

### Acceptance Criteria

- Vendor can request reset, validate token, and set a new password from UI only.
- Error messages from auth endpoints are surfaced cleanly.
- Successful auth flows redirect appropriately.

## Phase 2: Vendor Financial Surface

Status: Complete

Progress notes:

- Vendor dashboard, sales, ledger, balance, and payout request history are live against the vendor APIs.
- Submission errors and empty states are surfaced in the UI.

### Pages

1. `/` (convert existing static dashboard to live data)
2. `/vendor/sales` (new)
3. `/vendor/ledger` (new)
4. `/vendor/balance` (new)
5. `/vendor/payouts` (new: create request + history)

### API Bindings

- GET [server/api/vendor/sales.get.ts](server/api/vendor/sales.get.ts)
- GET [server/api/vendor/ledger.get.ts](server/api/vendor/ledger.get.ts)
- GET [server/api/vendor/balance.get.ts](server/api/vendor/balance.get.ts)
- GET [server/api/vendor/payout-requests.get.ts](server/api/vendor/payout-requests.get.ts)
- POST [server/api/vendor/payout-requests.post.ts](server/api/vendor/payout-requests.post.ts)

### Acceptance Criteria

- Vendor can view live sales, ledger, and balances.
- Vendor can submit payout requests and immediately see the new request in history.
- Validation errors (invalid amount, insufficient balance, rate limited) are clearly rendered.

## Phase 3: Admin Auth + Shell

Status: Complete

Progress notes:

- Admin login and protected shell are implemented.
- Admin navigation now exposes the next workflow areas as routes are added.

### Pages

1. `/admin/login` (new)
2. `/admin` (new dashboard shell)

### API Bindings

- POST [server/api/admin/login.post.ts](server/api/admin/login.post.ts)
- GET [server/api/admin/me.get.ts](server/api/admin/me.get.ts)

### Acceptance Criteria

- Admin can sign in and land in protected admin area.
- Non-admin token/user cannot access admin pages.

## Phase 4: Admin Vendor Management

Status: Complete

Progress notes:

- Approved vendor and vendor account CRUD pages are implemented.
- List pages include filters/search and edit flows are wired to the admin APIs.

### Pages

1. `/admin/approved-vendors` (list + filter)
2. `/admin/approved-vendors/new` (create)
3. `/admin/approved-vendors/[approvedVendorId]` (edit)
4. `/admin/vendors` (list + status filter)
5. `/admin/vendors/new` (create)
6. `/admin/vendors/[vendorId]` (detail/edit)

### API Bindings

- GET [server/api/admin/approved-vendors/index.get.ts](server/api/admin/approved-vendors/index.get.ts)
- POST [server/api/admin/approved-vendors/index.post.ts](server/api/admin/approved-vendors/index.post.ts)
- PATCH [server/api/admin/approved-vendors/[approvedVendorId].patch.ts](server/api/admin/approved-vendors/[approvedVendorId].patch.ts)
- DELETE [server/api/admin/approved-vendors/[approvedVendorId].delete.ts](server/api/admin/approved-vendors/[approvedVendorId].delete.ts)
- GET [server/api/admin/vendors/index.get.ts](server/api/admin/vendors/index.get.ts)
- POST [server/api/admin/vendors/index.post.ts](server/api/admin/vendors/index.post.ts)
- GET [server/api/admin/vendors/[vendorId].get.ts](server/api/admin/vendors/[vendorId].get.ts)
- PATCH [server/api/admin/vendors/[vendorId].patch.ts](server/api/admin/vendors/[vendorId].patch.ts)

### Acceptance Criteria

- Admin can manage approved-vendor mapping data and vendor accounts end to end.
- Duplicate/validation failures are visible and actionable.
- Status updates are reflected in list views without reload confusion.

## Phase 5: Admin Sales Import Operations

Status: Complete ✓

Progress notes:

- Added import history, upload, and batch detail pages.
- History filtering covers status, source period, and upload date range.
- Upload flow returns immediate batch summary with rejected rows and unmapped source visibility.
- All pages wired to existing backend APIs and styled consistently with admin patterns.
- E2E test suite (6 new tests) covers:
  - Upload page reachability
  - History list with filters visible
  - Navigation between upload and history
  - History table structure
  - Batch detail page navigation
  - Back navigation from batch detail
- All tests pass: 10 e2e (4 auth + 6 imports), 39 integration, 26 unit tests.

### Pages

1. `/admin/imports/upload` (implemented)
2. `/admin/imports` (implemented)
3. `/admin/imports/[batchId]` (implemented)

### API Bindings

- POST [server/api/admin/sales/imports.post.ts](server/api/admin/sales/imports.post.ts)
- GET [server/api/admin/imports.get.ts](server/api/admin/imports.get.ts)
- GET [server/api/admin/sales/[batchId].get.ts](server/api/admin/sales/[batchId].get.ts)

### Acceptance Criteria

- Admin can upload CSV and see import summary.
- Failed rows and unmapped sources are visible in batch detail.
- Imports list supports status/date filtering.

## Phase 6: Admin Payout Operations

Status: Complete

Progress notes:

- Built payout queue list page with status/date filtering.
- Decision panel allows approval (with optional review note) or rejection (with required reason).
- Disbursement creation form lets admin specify payment method and provider reference ID.
- Created new GET endpoint for single payout request detail to support the decision panel.
- All pages wired to existing backend APIs; integration tests pass (7 payout tests including approve/reject/disburse workflows).
- Admin navigation already includes "Payouts" link to the queue.

### Pages

1. `/admin/payout-requests` (queue + filters) - implemented
2. `/admin/payout-requests/[payoutId]` (decision panel) - implemented
3. `/admin/disbursements/new` (execute disbursement) - implemented

### API Bindings

- GET [server/api/admin/payout-requests/index.get.ts](server/api/admin/payout-requests/index.get.ts)
- GET [server/api/admin/payout-requests/[payoutId].get.ts](server/api/admin/payout-requests/[payoutId].get.ts) - new
- POST [server/api/admin/payout-requests/[payoutId]/approve.post.ts](server/api/admin/payout-requests/[payoutId]/approve.post.ts)
- POST [server/api/admin/payout-requests/[payoutId]/reject.post.ts](server/api/admin/payout-requests/[payoutId]/reject.post.ts)
- POST [server/api/admin/disbursements.post.ts](server/api/admin/disbursements.post.ts)

### Acceptance Criteria

- ✓ Admin can approve/reject from UI with review metadata.
- ✓ Admin can create PayPal/Venmo disbursements and see outcome details.
- ✓ Idempotent replay response is handled without duplicate UI state.

## Phase 7: Admin Operational Visibility

Status: Complete ✓

Progress notes:

- Added `/admin/audit` with action/entity/actor/date filters and event snapshots.
- Added `/admin/payout-failures` with reconciliation-focused summaries and CSV export.
- Linked imports and payout queue/detail pages into operational visibility routes.
- Included loading, empty, and error states across both operational visibility pages.

### Pages

1. `/admin/audit` (history + filters)
2. `/admin/payout-failures` (reconciliation board)
3. Integrate links between imports/payout queues and visibility pages.

### API Bindings

- GET [server/api/admin/audit.get.ts](server/api/admin/audit.get.ts)
- GET [server/api/admin/payout-failures.get.ts](server/api/admin/payout-failures.get.ts)
- GET [server/api/admin/imports.get.ts](server/api/admin/imports.get.ts)

### Acceptance Criteria

- ✓ Admin can filter and inspect critical audit trails.
- ✓ Failed payout reconciliation data is understandable and export-ready.

## Phase 8: UX Hardening and Test Expansion

Status: In progress

Progress notes:

- Added initial e2e coverage for vendor payout and admin payout decision entry flows.
- New Playwright spec validates payout page reachability, filter/form surfaces, and decision-page navigation when queue rows exist.
- Added e2e coverage for admin operational visibility routes (audit and payout-failures) including filter surface checks and admin-nav entry points.
- Added e2e accessibility and responsive checks for keyboard focus visibility on login surfaces and horizontal overflow checks on mobile/desktop for major auth and protected routes.
- Extended authenticated accessibility assertions for admin audit and payout detail flows, including main landmark presence and labeled actionable controls.

### Scope

- Add e2e coverage for:
  - vendor payout request flow
  - admin payout queue decision flow
  - admin import upload and failed batch review
- Accessibility pass on all major pages.
- Responsive behavior validation for mobile and desktop.

### Acceptance Criteria

- E2E tests cover primary money movement workflow.
- Core pages meet keyboard navigation and visible focus requirements.

## Suggested Execution Order

1. Phase 0 and Phase 1
2. Phase 2
3. Phase 3 and Phase 4
4. Phase 5
5. Phase 6
6. Phase 7
7. Phase 8

## Known Backend Dependencies to Plan Around

- Admin auth lifecycle endpoints beyond login/me are still pending.
- Mailgun-based notification delivery remains pending.
- Some transactional hardening tasks remain in docs and should be scheduled with UI rollout where user expectations rely on atomic behavior.
