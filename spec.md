# Book Suey Consignment Management System - Application Specification

## 1. Introduction

This document defines the implementation-ready requirements for the Book Suey Consignment Management System.

The application supports Book Suey staff and consignment vendors with:

- Vendor account management
- Quarterly sales import and ledgering
- Vendor balance transparency
- Payout request and disbursement workflows
- Auditable financial recordkeeping

## 2. User Roles

### 2.1 Admin Users

- Book Suey staff who operate and manage the system
- Responsibilities:
  - Create and maintain vendor records
  - Import quarterly sales files
  - Review and process payout requests
  - Execute and record disbursements
  - Resolve data exceptions

### 2.2 Consignment Vendors

- Individuals or entities who consign books to Book Suey
- Responsibilities:
  - Access their own sales and ledger history
  - View current and available balances
  - Request payout
  - View payout status and history

## 3. MVP Scope Matrix

### 3.1 In Scope (MVP)

- Vendor profile creation and lifecycle (active/inactive)
- Vendor authentication and access to self-service portal
- Quarterly CSV sales import by admins
- Sales validation and import summary reporting
- Ledger-based vendor balances
- Vendor payout request creation
- Admin payout approval/rejection
- Admin disbursement recording and reconciliation
- Admin disbursement execution using PayPal and Venmo
- Audit logging for critical actions
- Transactional email notifications for authentication and payout events only

### 3.2 Deferred (Post-MVP)

- Vendor self-service payment method management
- Vendor-initiated payout cancellation
- Automated payout scheduling
- Commission rule builder and advanced configuration UI
- Reporting dashboards and analytics exports
- POS integration
- Mobile app clients
- Inventory management for unsold items

### 3.3 Non-Goals (MVP)

- Automated tax reporting
- Marketing/broadcast communication tooling
- Real-time POS synchronization

## 4. Core Functional Areas and Acceptance Criteria

### 4.1 Vendor Account Management

Requirements:

- Admin can create a vendor with required profile fields.
- Admin can update vendor profile and consignment agreement metadata.
- Admin can activate or deactivate vendor access.

Acceptance criteria:

- Given a valid vendor payload, when admin creates vendor, then vendor record is persisted and uniquely identifiable.
- Given an inactive vendor, when they attempt login, then access is denied with a clear message.
- Given profile edits, when admin saves changes, then an audit event records before and after values for tracked fields.

### 4.2 Sales Import

Requirements:

- Admin can upload quarterly CSV files.
- System validates schema, data types, and required fields.
- Import is idempotent by import batch key and line-level dedupe key.
- System produces import summary with counts and errors.

Acceptance criteria:

- Given malformed CSV, when upload occurs, then import is rejected with actionable validation errors.
- Given duplicate row key, when import runs, then duplicate row is skipped and reported.
- Given successful import, when completed, then ledger entries are created and vendor balances update deterministically.

### 4.3 Vendor Self-Service Portal

Requirements:

- Vendor can view sales history and ledger entries scoped to their account.
- Vendor can view totals by pending, available, and paid amounts.
- Vendor can create payout requests from available balance.
- Payout requests must be for a positive amount not exceeding available balance.

Acceptance criteria:

- Given authenticated vendor, when viewing portal, then only their own records are visible.
- Given payout request over available balance, when submitted, then request is rejected with explanation.
- Given approved payout, when disbursed, then vendor payout status updates and appears in history.
- Given payout request for zero or negative amount, when submitted, then request is rejected with explanation.

### 4.4 Payment Processing

Requirements:

- Vendor can submit payout request.
- Admin can approve or reject payout request.
- Admin can record disbursement details and mark completion or failure.
- Disbursement methodType for MVP must be one of: paypal, venmo.
- System maintains full audit chain.

Acceptance criteria:

- Given payout request, when approved, then status transitions to approved and reserved amount is tracked.
- Given disbursement failure, when recorded, then status becomes failed and reserved amount is returned to available balance.
- Given completed disbursement, when finalized, then status is paid and immutable payment record is retained.
- Given unsupported disbursement methodType, when disbursement is created, then request is rejected with a validation error.

### 4.5 Admin Identity and Access Management

Requirements:

- System stores admin accounts as first-class identities separate from vendor accounts.
- Admin authentication uses dedicated admin endpoints.
- Admin account status controls access (active or disabled).
- Admin login attempts are rate limited and lockout is enforced after repeated failures.
- System provides admin password reset and password update flows.
- Initial admin access is established through a one-time bootstrap workflow.
- Admin account lifecycle events are audited.

Acceptance criteria:

- Given a valid active admin account, when admin logs in, then a JWT with role=admin is issued.
- Given a disabled admin account, when login is attempted, then access is denied with a clear message.
- Given repeated failed login attempts above threshold, when further login is attempted, then account is locked until lockout duration elapses or an authorized admin unlocks it.
- Given a valid password reset token, when admin sets a new password, then token is invalidated and old credentials no longer authenticate.
- Given an admin account create, status change, password reset, or unlock action, when action completes, then an audit event is persisted.

## 5. Domain Model (MVP)

### 5.1 Entities

- ApprovedVendor
  - basil_id, last_name, first_name, phone, email
  - Used to pre-populate vendor accounts during registration
  - Sales import "Source" column maps to first_name + last_name for vendor linking
- Vendor
  - vendorId, legalName, displayName, email (unique), phone, status, createdAt, updatedAt
  - May be linked to an ApprovedVendor via email during registration
- AdminAccount
  - adminId, email (unique), passwordHash, status (active|disabled), createdAt, updatedAt
  - failedLoginAttempts, lockoutUntil, lastLoginAt
  - passwordResetToken, passwordResetExpires
- ConsignmentAgreement
  - agreementId, vendorId, effectiveDate, commissionModel, termsVersion
- SalesImportBatch
  - batchId, sourcePeriod, uploadedBy, uploadedAt, status, totalRows, validRows, invalidRows
- SaleRecord
  - saleId, vendorId, sourceBatchId, soldAt, grossAmount, commissionAmount, sourceRowKey, currency (USD)
  - Transaction details: title, quantity, unit, discount, extended (visible to vendors)
  - Admin-only field: saleOrderId (from Sale/Order ID for POS lookup)
  - Note: SaleRecord stores the source data including all transaction details
- LedgerEntry
  - entryId, vendorId, entryType, amount, currency (USD), referenceType, referenceId, occurredAt
  - referenceType = "SaleRecord" and referenceId = saleId for sales imports
  - Vendor-visible fields are fetched from linked SaleRecord (title, quantity, unit, discount, extended)
  - amount is derived from max(Cost, Credit) from ReportSalesDetail - THIS affects vendor balance
- BalanceSnapshot
  - vendorId, pendingAmount, availableAmount, paidAmount, asOf
- PayoutRequest
  - payoutRequestId, vendorId, requestedAmount, status, requestedAt, reviewedBy, reviewedAt, reviewReason
- PaymentDisbursement
  - disbursementId, payoutRequestId, methodType (paypal|venmo), providerReference, disbursedAt, status, failureReason
- AuditEvent
  - auditEventId, actorId, actorRole, action, entityType, entityId, before, after, createdAt

### 5.2 Required Constraints

- Monetary values use fixed-point decimal, never float.
- All amounts are in USD.
- All financial writes are append-only via ledger entries.
- Every mutation of payout and vendor status emits audit events.
- Vendor data access is tenant-scoped by vendorId.
- Vendor email addresses must be unique across all vendor accounts.
- Admin email addresses must be unique across all admin accounts.

## 6. Financial Lifecycle and State Model

### 6.1 Payout Request States

- requested
- approved
- rejected
- disbursing
- paid
- failed

### 6.2 Allowed Transitions

- requested -> approved
- requested -> rejected
- approved -> disbursing
- disbursing -> paid
- disbursing -> failed

### 6.3 Balance Rules

- Imported net sales increase vendor balance. New sales become available immediately after a successful import commit.
- Approved payout reserves amount from available balance.
- Paid payout increases paid total and closes reservation.
- Failed payout returns reservation to available balance.

Balance formula requirements:

- pendingAmount = sum of ledger amounts that are not yet available (MVP default is immediate availability, so pendingAmount is expected to be zero unless explicitly changed by a future policy migration)
- availableAmount = total credits minus total reservations plus reservation releases minus paid disbursements
- paidAmount = total successfully disbursed payout amounts

### 6.4 Payout Rules

- Payout amounts must be positive and cannot exceed available balance.
- There is no minimum or maximum payout amount limit.
- All amounts are in USD.

### 6.5 Concurrency and Transaction Rules

- Payout approval and disbursement writes must execute in a database transaction.
- Status transitions must use conditional updates with expected prior state checks.
- Approval must succeed only when current status is requested at commit time.
- Disbursement creation must be idempotent by payoutRequestId plus client idempotency key.
- At most one active disbursement attempt can exist for a payout request at a time.

## 7. Data Requirements

System stores and exposes:

- Vendor profile and agreement metadata
- Sales import batches and row-level sale records
- Ledger entries and derived balance snapshots
- Payout requests and disbursement records
- Audit events for security and financial traceability

Data retention baseline:

- Financial and audit records retained for at least 7 years unless policy changes.

## 8. Security and Compliance Requirements

- Authentication:
  - Secure authentication for admins and vendors
  - Password hashing using bcrypt with cost factor >= 12
  - Session expiration and re-authentication on sensitive actions
  - Password reset flow via time-limited email token (24-hour expiry)
  - Initial admin bootstrap process required before first admin login
- Authorization:
  - Role-based access control with vendor data isolation
  - All admins have full admin privileges (no role differentiation)
- Data protection:
  - Encryption in transit and at rest
  - Secrets managed through environment variables and secret store
  - PII data (email, name, phone) stored separately from financial records for GDPR compliance
- Auditability:
  - Immutable audit events for critical operations
- Privacy and compliance:
  - Minimize stored PII
  - Define retention and deletion policies for non-financial personal data
  - Financial records retained for 7 years; PII can be anonymized upon deletion request while preserving financial traceability

## 9. Technical Stack

### 9.1 Application Platform

- Frontend: Nuxt (Vue)
- Backend runtime: Nitro (Nuxt server engine)
- Database: MongoDB Atlas
- ODM: Mongoose
- Email service: Mailgun

Recommended implementation stack: Nuxt + Nitro + MongoDB Atlas + Mongoose + Mailgun.

### 9.2 Architecture Decisions for MVP

- API style: Nitro server routes with JSON APIs
- Data access: Mongoose models with repository/service separation
- Validation: schema-level validation plus request payload validation
- Async jobs: queue-backed worker for email and long-running imports
- Observability: structured logs, error tracking, and admin-visible import/payout event logs

## 10. API Contract Draft (MVP)

### 10.1 Admin Endpoints

- POST /api/admin/login
- POST /api/admin/refresh
- POST /api/admin/logout
- GET /api/admin/me
- POST /api/admin/reset-password
- POST /api/admin/update-password
- POST /api/admin/vendors
- PATCH /api/admin/vendors/:vendorId
- POST /api/admin/sales/imports
- GET /api/admin/sales/imports/:batchId
- GET /api/admin/payout-requests
- POST /api/admin/payout-requests/:id/approve
- POST /api/admin/payout-requests/:id/reject
- POST /api/admin/disbursements

### 10.2 Vendor Endpoints

- GET /api/vendor/me
- GET /api/vendor/sales
- GET /api/vendor/ledger
- GET /api/vendor/balance
- POST /api/vendor/payout-requests
- GET /api/vendor/payout-requests

### 10.3 Error Contract

- Standard error envelope:
  - code
  - message
  - details
  - requestId
- Financial mutation failures return explicit business error codes.

Required business error codes (MVP):

- AUTH_INVALID_CREDENTIALS
- AUTH_ACCOUNT_DISABLED
- AUTH_ACCOUNT_LOCKED
- AUTH_TOKEN_EXPIRED
- AUTH_RATE_LIMITED
- IMPORT_INVALID_FILE_FORMAT
- IMPORT_MISSING_REQUIRED_COLUMN
- IMPORT_INVALID_ROW_DATA
- IMPORT_DUPLICATE_BATCH
- IMPORT_DUPLICATE_ROW
- IMPORT_UNMAPPED_SOURCE
- PAYOUT_INVALID_AMOUNT
- PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE
- PAYOUT_INVALID_STATE_TRANSITION
- PAYOUT_CONCURRENT_MODIFICATION
- PAYOUT_UNSUPPORTED_METHOD
- DISBURSEMENT_PROVIDER_FAILURE

### 10.4 Payout Method Rules (MVP)

- Supported disbursement methodType values: paypal, venmo.
- Disbursement creation must reject any methodType outside the supported set.

## 11. CSV Import Specification (MVP)

### 11.1 Input File Format

The sales import accepts the ReportSalesDetail CSV format with the following column structure:

- Date, Time, Age, ISBN, Title, Authors, Line Type, Sale/Order ID, Condition, Section, Location, Binding, Publisher, Source, Event, Quantity, Unit, Credit Used, Discount, Extended, Cost, Credit, Cash, Store Rem., Chain Rem., On Order, Sale Type, Register, Barcode, Customer

Only a subset of these fields are extracted and stored in the sales log database.

### 11.2 Source Column and Vendor Mapping

- The "Source" column contains the concatenation of first_name and last_name from the ApprovedVendor database
- During import, the Source value is parsed to match against ApprovedVendor records
- Sales are linked to vendor accounts via this Source-to-ApprovedVendor mapping
- If a vendor registers with an email matching an ApprovedVendor, they are automatically linked to their sales history

### 11.3 Fields Extracted for Storage

- saleId (generated from Sale/Order ID)
- vendorId (resolved from Source column via ApprovedVendor mapping)
- soldAt (from Date + Time)
- grossAmount (from Extended)
- commissionAmount (from Discount)
- currency (USD)
- sourceRowKey (from Date + Sale/Order ID for deduplication)
- Transaction details stored in SaleRecord: title, quantity, unit, discount, extended (vendor-visible)
- Admin-only field stored in SaleRecord: saleOrderId (from Sale/Order ID for POS lookup)
- LedgerEntry amount: max(Cost, Credit) determines the financial amount (affects balance)

### 11.3.1 Amount Derivation Rules

- Ledger amount is derived from the greater of Cost or Credit columns
- This ensures vendors receive the correct payout regardless of which value is higher
- Extended (grossAmount) is stored separately for transparency but is not the payout amount

### 11.4 Validation Rules

- Required columns must be present: Date, Time, Source, Extended, Discount, Cost, Credit, Title, Quantity, Unit, Sale/Order ID
- Amount fields must be valid non-negative decimals.
- Date and Time must be parseable to create soldAt timestamp.
- Source must match an ApprovedVendor record (first_name + " " + last_name pattern)
- Currency is fixed as USD for all records
- Rows with empty or unparseable Source values are rejected
- Quantity must be a positive integer
- Unit must be a valid decimal value

### 11.5 Idempotency and Dedupe

- Batch idempotency key: source period plus uploaded file checksum.
- Row dedupe key: Sale/Order ID plus Date for the sourceRowKey.

### 11.6 Import Output

- Import summary contains total, accepted, rejected, duplicate counts.
- Error report includes row number, reason, and remediation hint.
- Unmapped Source values are reported for vendor list maintenance.

### 11.7 Field Visibility Rules

**Admin-only fields:**

- saleOrderId - Used for POS lookup and reconciliation

**Vendor-visible fields (shown in ledger and sales history):**

- title - Item description for transparency
- quantity - Number of items sold
- unit - Per item cost
- discount - Discount applied to sale
- extended - Total sale after discount (before sales tax)

**Amount calculation:**

- Ledger amount is derived from max(Cost, Credit) columns to ensure vendors receive correct payout

## 12. Operational Requirements

- Environments:
  - local, staging, production with separate data stores
- Backup and recovery:
  - daily backups, documented restore process
  - target RPO <= 24 hours, target RTO <= 8 hours
- Monitoring:
  - alert on failed imports, failed disbursements, and auth anomalies
- Rate limiting:
  - Authentication endpoints: 5 attempts per 15 minutes per IP/email
  - Payout request endpoints: 10 requests per hour per vendor
  - All rate limits logged for security monitoring
- File upload limits:
  - CSV import maximum file size: 10MB
  - CSV import maximum row count: 5000 rows per batch
- Account security:
  - Account lockout after 10 consecutive failed login attempts
  - Auto-unlock after 30 minutes, or admin unlock required
- Configuration:
  - typed environment config with startup validation

## 13. Testing Strategy

- Unit tests:
  - balance calculations, state transitions, CSV validators
- Integration tests:
  - import pipeline, payout approval/disbursement flow, audit event emission
- End-to-end tests:
  - vendor login, balance visibility, payout request lifecycle
- Regression suite:
  - fixtures for edge-case monetary and duplicate import scenarios
- Release gate:
  - critical financial workflow tests must pass before deployment
