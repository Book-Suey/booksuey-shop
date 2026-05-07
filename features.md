# Book Suey Consignment Management System Features

## What We Are Building

Book Suey is building a consignment management system with two primary surfaces:

- An admin operations console for staff
- A vendor self-service portal for consignors

The MVP is centered on four capabilities:

- Managing vendor accounts and access
- Importing quarterly sales data safely from CSV
- Maintaining accurate ledger-backed balances
- Processing vendor payout requests through an admin-controlled PayPal and Venmo disbursement workflow

The product should prioritize financial correctness, auditability, and operational clarity over feature breadth.

## Detailed Features

### 1. Platform and Authentication Features

#### Authentication and access

- Secure vendor login
- Access only vendor-scoped data
- Deny access when account is inactive
- Password reset via time-limited email token
- Automatic vendor account linking: when a vendor registers with an email matching an ApprovedVendor, they are automatically linked to their sales history and balance

#### Admin identity and access management

- Store admin accounts as first-class records with unique email, bcrypt password hash, status, and lockout fields
- Authenticate admins with dedicated admin login and refresh endpoints
- Require admin-role JWTs for all admin routes
- Support admin password reset and update flows with time-limited reset tokens
- Track admin failed login attempts and auto-unlock lockouts after a configured duration
- Seed the initial admin account through a one-time bootstrap workflow
- Record audit events for admin login, logout, account creation, status updates, and password changes

### 2. Vendor Management Features

#### Approved vendor list

- Maintain an approved vendor database with basil_id, last_name, first_name, phone, and email
- This list is used for pre-approving vendors and mapping sales during import
- Used for automatic vendor account linking during registration

#### Admin vendor account management

- Create vendor accounts with required identity and contact fields
- Edit vendor profile and agreement metadata
- Activate or deactivate vendor access
- Maintain internal vendor identifiers and external identifiers used during imports
- Enforce unique email addresses across all vendor accounts
- Record audit events for all profile and status changes

### 3. Sales Import and Ledger Features

#### Sales import operations

- Upload quarterly CSV files in ReportSalesDetail format
- Parse and validate the fixed input format regardless of which fields are stored
- Extract fields: Date+Time (soldAt), Source (for vendor mapping), Extended (grossAmount), Discount (commissionAmount), Cost, Credit
- Extract vendor-visible transaction details: Title (item description), Quantity, Unit (per item cost)
- Map Source column to ApprovedVendor records (concatenation of first_name + last_name)
- Link sales to vendor accounts via ApprovedVendor mapping
- Calculate ledger amount from max(Cost, Credit) for correct payout
- Reject malformed imports with row-level validation errors
- Deduplicate rows using a deterministic row key
- Prevent duplicate full-batch imports using a batch idempotency key
- Produce an import summary with accepted, rejected, and duplicate counts
- Create ledger entries from accepted sales rows
- Store admin-only saleOrderId for POS lookup and vendor-visible transaction details

#### Ledger-first accounting

- All financial changes are append-only ledger entries
- Balances are derived from ledger data rather than manually edited
- Paid, pending, and available amounts are calculated deterministically

#### Balance protection rules

- Imported net sales increase vendor balance and become available immediately after successful import commit
- Approved payout requests reserve funds from available balance
- Successful disbursements move value into paid totals
- Failed disbursements release reserved funds back to available balance

#### Import integrity

- Re-uploading the same batch must not double-credit vendors
- Duplicate source rows are skipped and reported
- Import processing must be safe to retry

### 4. Vendor Financial Views and Payout Features

#### Vendor financial visibility

- View sales history derived from imported records
- View ledger history with financial references
- View balance summary split by pending, available, and paid amounts
- View payout request history and statuses

#### Vendor payout requests

- Submit payout requests against available balance only
- Receive validation feedback for insufficient balance or invalid state
- See request progress through requested, approved, rejected, disbursing, paid, or failed states
- Payout amounts must be positive (greater than zero)

### 5. Admin Payout Review and Disbursement Features

#### Payout operations

- Review vendor payout requests in a dedicated admin queue
- Approve or reject payout requests with review metadata
- Prevent payout approval when balance is insufficient or request state is invalid
- Record disbursement details and outcome for approved requests
- Execute payouts using PayPal or Venmo only in MVP
- Store provider reference IDs and disbursement timestamps
- Return reserved funds to available balance if a disbursement fails
- All payout amounts are in USD with no minimum or maximum limits

#### Audit and operations visibility

- View audit history for vendor changes, imports, payout decisions, and disbursements
- View import status and error reports
- View failed payout attempts and reconciliation details

### 6. Operational Features

#### Transactional email notifications

- Authentication-related emails as configured for access setup or recovery
- Payout request confirmation emails
- Payout approval and rejection emails
- Payout completion and failure emails

#### Monitoring and controls

- Structured logs for import and payout workflows
- Alerting for failed imports, failed disbursements, and authentication anomalies
- Typed environment configuration with startup validation
- Backup and recovery support consistent with the spec

## End-to-End Flows

### Flow 1: Vendor onboarding and access

1. Admin creates a vendor account.
2. Admin sets the vendor status to active.
3. System sends the vendor an authentication or access setup email.
4. Vendor signs in and lands in a vendor-only portal.
5. Audit events are recorded for account creation and activation.

### Flow 1B: Admin access bootstrap and authentication

1. System operator runs a one-time bootstrap flow to create the first admin account.
2. Admin signs in through a dedicated admin authentication endpoint.
3. System issues an admin-role token used only for admin route access.
4. Admin can rotate password through authenticated update flow or reset flow.
5. Audit events are recorded for bootstrap, login, logout, and credential changes.

### Flow 2: Quarterly sales import to balance update

1. Admin uploads a quarterly CSV file.
2. System validates headers, data types, vendor mapping, and business rules.
3. System computes a batch idempotency key and row dedupe keys.
4. Valid rows are accepted and transformed into sale records and ledger entries.
5. Invalid and duplicate rows are reported back in the import summary.
6. Vendor balances are recalculated or refreshed from ledger-backed state.
7. Audit events are stored for the import action.

### Flow 3: Vendor payout request to admin review

1. Vendor opens the balance view and sees pending, available, and paid totals.
2. Vendor submits a payout request for an amount less than or equal to available balance.
3. System validates the request (positive amount, within balance) and creates a payout request in the requested state.
4. Admin reviews the request in the payout queue.
5. Admin approves or rejects the request.
6. On approval, funds are reserved from available balance.
7. On rejection, the request is closed with a reason and no funds are disbursed.

### Flow 4: Approved payout to disbursement completion

1. Admin selects an approved payout request.
2. Admin initiates disbursement using PayPal or Venmo.
3. System records the provider reference and transitions the payout to disbursing.
4. If the disbursement succeeds, status becomes paid and an immutable disbursement record is stored.
5. If the disbursement fails, status becomes failed and reserved funds are returned to available balance.
6. Vendor sees the updated payout status and receives a transactional notification.

### Flow 5: Reconciliation and exception handling

1. Admin reviews failed imports or failed disbursements.
2. Admin inspects validation errors, audit events, and provider references.
3. Admin retries or corrects the underlying issue through approved operational workflows.
4. New corrective actions produce new audit records and, where applicable, new ledger events.

### Financial Rules

- All amounts are in USD.
- Payout amounts must be positive (greater than zero).
- There are no minimum or maximum payout amount limits.

## Technical Decisions

### Architecture

- Build a single Nuxt application with Nitro server routes for the web UI and backend APIs
- Separate admin and vendor APIs by route namespace
- Use a service-oriented backend structure with clear modules for vendor management, imports, ledgering, payouts, disbursements, notifications, and audit logging
- Use background job processing for emails and longer-running import tasks

### Data Model

Core entities:

- AdminAccount (adminId, email unique, passwordHash, status, failedLoginAttempts, lockoutUntil)
- ApprovedVendor (basil_id, last_name, first_name, phone, email) - pre-approved vendors for registration linking and sales import mapping
- Vendor (email must be unique)
- ConsignmentAgreement
- SalesImportBatch
- SaleRecord (currency is USD, vendorId resolved from Source via ApprovedVendor mapping)
- LedgerEntry (currency is USD)
- BalanceSnapshot
- PayoutRequest
- PaymentDisbursement
- AuditEvent

Key modeling rules:

- Vendor data access must always be scoped by vendorId
- Vendor email addresses must be unique across all vendor accounts
- ApprovedVendor email can match Vendor email for automatic account linking during registration
- Source column (first_name + last_name concatenation) is used to map sales to ApprovedVendor records
- Payout methodType is restricted to paypal or venmo in MVP
- Payout state transitions must be enforced explicitly in the service layer
- Import batches and sale rows must support deterministic deduplication
- All monetary amounts are in USD

### Privacy and Compliance

- PII data (email, name, phone) stored separately from financial records for GDPR compliance
- Financial records retained for 7 years; PII can be anonymized upon deletion request while preserving financial traceability

### Financial Consistency

- Use fixed-precision decimals for all money values
- Never use floating point for financial amounts
- All amounts are in USD; currency field in imports must be "USD"
- Treat the ledger as the financial source of truth
- Keep balance snapshots as a read optimization, not the canonical source of record
- Execute payout reservation and disbursement updates in database transactions
- Enforce conditional state transitions at commit time to prevent concurrent approvals/disbursements
- Require idempotency keys for disbursement creation to prevent duplicate provider attempts
- Payout amounts must be positive (greater than zero); no minimum or maximum limits

### Validation and Contracts

- Validate request payloads at the API boundary
- Enforce schema constraints in Mongoose models
- Use a standard error envelope with code, message, details, and requestId
- Return explicit business error codes for payout and financial state violations

### Security

- Role-based access control for admin and vendor users
- All admins have full admin privileges with no role differentiation
- Admin authentication and session lifecycle are managed independently from vendor authentication
- Vendor-scoped authorization at both route and data access levels
- Session expiration and re-authentication for sensitive actions
- Password hashing using bcrypt with cost factor >= 12
- Password reset flow via time-limited email token (24-hour expiry)
- Account lockout after 10 consecutive failed login attempts (auto-unlock after 30 minutes)
- Encryption in transit and at rest
- Secret management through environment variables and secret storage
- Rate limiting: 5 auth attempts per 15 min per IP/email, 10 payout requests per hour per vendor
- File upload limits: 10MB max CSV size, 5000 rows max per batch

### Observability and Operations

- Structured logs with request ID and actor context
- Audit events for every critical mutation
- Metrics for imports, payout approvals, payout failures, and email delivery
- Alerting on failed disbursements, repeated import failures, and suspicious auth behavior
- Separate local, staging, and production environments with isolated data stores

### Testing

- Unit tests for CSV validation, deduplication, ledger math, and payout state transitions
- Integration tests for imports, payout approval/rejection, disbursement success/failure, and audit event creation
- End-to-end tests for vendor login, balance visibility, payout requests, and admin payout handling
- Regression tests for duplicate imports, edge-case monetary calculations, and retry behavior

## Implementation Roadmap

### Phase 1: Foundations and Project Setup

Goals:

- Establish the app structure, core modules, and environment configuration
- Set up authentication, authorization, and shared backend patterns
- Define the base domain entities and persistence layer

Deliverables:

- Nuxt app structure for admin and vendor surfaces
- Nitro API namespaces for admin and vendor routes
- MongoDB and Mongoose connection setup
- Base schemas for Vendor, ConsignmentAgreement, AuditEvent, and auth-related models
- Shared request validation, error envelope, and logging utilities
- Environment validation and secrets configuration

Dependencies:

- None; this is the starting phase

Minimum required tests:

- Unit tests for config validation and role guards
- Integration tests for authentication flow and route protection
- Smoke tests confirming admin and vendor route isolation

### Phase 2: Vendor Management and Access

Goals:

- Deliver vendor account lifecycle management for admins
- Deliver secure vendor access to the self-service portal

Deliverables:

- ApprovedVendor CRUD management for admins
- Admin create, edit, activate, and deactivate vendor workflows
- Vendor login and vendor-scoped session handling
- Automatic vendor account linking when registration email matches ApprovedVendor
- Audit logging for vendor profile and status mutations
- Vendor dashboard shell with authenticated access

Dependencies:

- Requires Phase 1 auth, schemas, validation, and route structure

Minimum required tests:

- Unit tests for vendor status transition rules
- Integration tests for vendor CRUD and audit event creation
- End-to-end tests for admin creating a vendor and vendor login success/failure

### Phase 3: Sales Import and Ledger Engine

Goals:

- Make CSV imports safe, deterministic, and financially correct
- Establish the ledger as the source of truth for balances

Deliverables:

- CSV upload endpoint and import processing pipeline for ReportSalesDetail format
- Source-to-ApprovedVendor mapping logic (first_name + last_name concatenation)
- Validation for required headers, dates, decimals, and vendor mapping
- Batch idempotency and row deduplication
- SaleRecord, LedgerEntry, and BalanceSnapshot models with vendor linking
- Import summary reporting and persisted import status history

Dependencies:

- Requires Phase 2 vendor records and admin access controls

Minimum required tests:

- Unit tests for CSV schema validation, dedupe logic, and balance calculations
- Integration tests for successful import, malformed import, and duplicate batch behavior
- Regression tests for repeated imports and edge-case monetary values

### Phase 4: Vendor Financial Views and Payout Requests

Goals:

- Expose vendor financial data clearly and safely
- Allow vendors to submit payout requests from available balance

Deliverables:

- Vendor sales history view
- Vendor ledger and balance summary views
- Vendor payout request submission flow
- PayoutRequest model and requested-state creation logic
- Vendor payout history and status tracking

Dependencies:

- Requires Phase 3 ledger and balance derivation

Minimum required tests:

- Unit tests for available-balance validation rules
- Integration tests for payout request creation and invalid request rejection
- End-to-end tests for vendor viewing balances and submitting a payout request

### Phase 5: Admin Payout Review and Disbursement

Goals:

- Allow admins to review, approve, reject, and execute payouts
- Ensure payout state transitions and balance reservation rules are enforced

Deliverables:

- Admin payout review queue
- Approve and reject actions with review metadata
- Balance reservation logic on approval
- PayPal and Venmo disbursement recording flow
- PaymentDisbursement model with provider reference tracking
- Failure handling that returns reserved balance to available funds

Dependencies:

- Requires Phase 4 payout request creation and Phase 3 ledger consistency

Minimum required tests:

- Unit tests for payout state machine and reservation rules
- Integration tests for approve, reject, paid, and failed disbursement paths
- End-to-end tests for full vendor request to admin disbursement workflow

### Phase 6: Notifications, Audit Visibility, and Operational Hardening

Goals:

- Complete the operational support layer for MVP readiness
- Make failures diagnosable and critical actions traceable

Deliverables:

- Transactional email handling for auth and payout events
- Admin-facing audit and import/disbursement status visibility
- Structured logging, alerts, and operational dashboards or log views
- Backup, recovery, and deployment readiness checks

Dependencies:

- Requires Phases 2 through 5 to produce meaningful events and workflows

Minimum required tests:

- Integration tests for notification triggers and audit event emission
- End-to-end tests for payout event notifications on approval, rejection, success, and failure
- Operational smoke tests for logging, alert wiring, and production config validation

### Recommended Delivery Order

1. Phase 1: Foundations and Project Setup
2. Phase 2: Vendor Management and Access
3. Phase 3: Sales Import and Ledger Engine
4. Phase 4: Vendor Financial Views and Payout Requests
5. Phase 5: Admin Payout Review and Disbursement
6. Phase 6: Notifications, Audit Visibility, and Operational Hardening

### MVP Release Criteria

- Admins can manage vendors and control access
- Quarterly CSV imports are validated, idempotent, and auditable
- Vendor balances are correct and ledger-backed
- Vendors can request payouts against available balance only
- Admins can approve, reject, and record PayPal or Venmo disbursements
- Critical workflows have unit, integration, and end-to-end coverage
- Audit logs, notifications, and operational monitoring are in place

## Status Overview (as of 2026-05-07)

### Overall Status

- Backend/API implementation for Phases 1 through 5 is largely in place and covered by unit/integration tests.
- Phase 6 has started with admin visibility endpoints (audit history, import status, payout failure reconciliation).
- UI implementation is still limited compared with documented feature scope.

### Completed

- Platform/vendor/admin authentication core flows and route protection.
- Vendor management APIs (ApprovedVendor and Vendor CRUD-style admin operations).
- Sales import/ledger engine with validation, idempotency, and balance snapshot recomputation.
- Vendor financial APIs (sales, ledger, balance, payout request create/history).
- Admin payout review/disbursement APIs (queue, approve/reject, paid/failed, idempotency, reconciliation paths).
- Admin operations visibility APIs for audit/import/payout-failure review.

### Partially Complete

- Operational hardening areas (email, structured logging/alerts, backup/recovery automation) remain partial.
- Some multi-document write paths are not yet fully transaction-hardened in all flows.

### Pending

- Missing UI surfaces for admin and vendor workflows beyond registration/login/basic dashboard shell.
- Mailgun-backed transactional notifications and broader operational controls.
- Completion of remaining lifecycle endpoints and operator workflows called out in feature detail docs.

### Verification Status

- Current CI-style verification commands are passing locally (build, lint, typecheck, unit/integration/e2e/coverage).
- Final release readiness remains blocked on operational controls and missing UI implementation.

## Out of Scope for MVP

### Deferred features

- Vendor self-service payment method management
- Vendor-initiated payout cancellation
- Automated payout scheduling
- Advanced commission rule configuration UI
- Reporting dashboards and export-heavy analytics
- POS integration
- Mobile application support
- Inventory management for unsold items

### Explicit non-goals

- Automated tax reporting
- Marketing or broadcast communication tooling
- Real-time POS synchronization
