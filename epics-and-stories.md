# Book Suey Consignment Management System Epics and Stories

## Purpose

This document translates the product specification and feature roadmap into a set of epics and implementation-ready stories. It is designed to support backlog planning, milestone scoping, and engineering execution.

## Story Conventions

- Story format: As a user, I want, so that.
- Acceptance criteria are written to be testable.
- Stories are grouped by epic in recommended delivery order.
- MVP-focused only; deferred items are listed separately at the end.

## Epic 1: Platform Foundations and Application Setup

Goal:
Establish the core application structure, environment configuration, shared backend patterns, and deployment-ready foundations.

### Story 1.1: Set up application structure

As a developer, I want a clear application structure for admin and vendor surfaces so that new features can be built consistently.

Acceptance criteria:

- Nuxt app structure is established for shared app shell and route organization.
- Nitro API routes are separated into admin and vendor namespaces.
- Shared utilities exist for API responses, error handling, and logging.

### Story 1.2: Configure environment and secrets

As a developer, I want validated environment configuration so that the app fails fast when required settings are missing.

Acceptance criteria:

- Required environment variables are defined and validated at startup.
- Separate local, staging, and production configuration paths are documented.
- Secrets are loaded from environment or secret storage, not hardcoded.

### Story 1.3: Set up database connectivity

As a developer, I want a reliable MongoDB and Mongoose connection layer so that data models can be implemented consistently.

Acceptance criteria:

- MongoDB connection is initialized through a shared module.
- Mongoose connection errors are logged clearly.
- Data access can be reused across API handlers and services.

### Story 1.4: Establish authentication and role guards

As a system administrator, I want admin and vendor roles enforced so that users can only access allowed resources.

Acceptance criteria:

- Admin-only routes reject unauthenticated and non-admin users.
- Vendor routes require authentication.
- Shared authorization helpers support vendor-scoped access checks.
- Password hashing uses bcrypt with cost factor >= 12.

### Story 1.5: Implement rate limiting and account lockout

As a system, I want to prevent brute force attacks so that accounts remain secure.

Acceptance criteria:

- Authentication endpoints enforce 5 attempts per 15 minutes per IP/email.
- Account locks after 10 consecutive failed login attempts.
- Locked accounts auto-unlock after 30 minutes.
- Failed authentication attempts are logged for security monitoring.

### Story 1.6: Implement password reset flow

As a vendor, I want to reset my password if I forget it so that I can regain access to my account.

Acceptance criteria:

- Vendor can request password reset via email.
- Reset token expires after 24 hours.
- New password must meet security requirements.
- Password reset email is sent through configured email provider.

## Epic 2: Vendor Management and Access

Goal:
Enable Book Suey staff to manage vendors and give vendors secure access to their own portal.

### Story 2.1: Create vendor accounts

As an admin, I want to create a vendor account so that a consignor can be tracked in the system.

Acceptance criteria:

- Admin can create a vendor with required profile fields.
- Created vendor receives a unique vendor identifier.
- Vendor creation emits an audit event.
- Creating a vendor with an email that already exists is rejected with a clear error.

### Story 2.2: Edit vendor profiles

As an admin, I want to update vendor profile and agreement metadata so that vendor records remain current.

Acceptance criteria:

- Admin can edit profile fields and agreement metadata.
- Updated fields are persisted correctly.
- Before and after values for tracked fields are recorded in audit logs.

### Story 2.3: Activate and deactivate vendors

As an admin, I want to activate or deactivate a vendor so that access can be controlled operationally.

Acceptance criteria:

- Admin can toggle vendor status between active and inactive.
- Inactive vendors cannot access vendor-only routes.
- Status changes are audit logged.

### Story 2.4: Vendor sign-in

As a vendor, I want to securely sign in so that I can view my account data.

Acceptance criteria:

- Active vendors can authenticate successfully.
- Inactive vendors are denied access with a clear error.
- Authenticated vendors are routed to vendor-scoped pages only.
- Failed login attempts are tracked and trigger account lockout after 10 failures.
- Rate limiting of 5 attempts per 15 minutes per IP/email is enforced.

### Story 2.5: Vendor dashboard shell

As a vendor, I want a basic dashboard shell so that I can navigate my sales, ledger, balance, and payout pages.

Acceptance criteria:

- Authenticated vendor lands on a dashboard page.
- Primary vendor navigation includes balance, sales, ledger, and payouts.
- Vendor UI does not expose admin navigation.

## Epic 3: Sales Import Pipeline

Goal:
Provide admins with a safe, repeatable quarterly CSV import workflow that creates trusted financial records.

### Story 3.1: Upload quarterly sales CSV

As an admin, I want to upload a quarterly CSV file so that sales can be imported into the system.

Acceptance criteria:

- Admin can submit a CSV file through an import endpoint or admin UI.
- Uploaded file is associated with a source period and uploader.
- Import batch record is created for tracking.
- File size limit of 10MB is enforced.
- Row count limit of 5000 rows per batch is enforced.

### Story 3.2: Validate CSV structure and business rules

As an admin, I want import validation to catch bad data before it affects balances so that financial integrity is preserved.

Acceptance criteria:

- Required headers are validated.
- sold_at, gross_amount, commission_amount, net_amount, and vendor mapping are validated.
- Currency column must be "USD"; other currencies are rejected.
- Invalid rows are rejected with row-level error messages.

### Story 3.3: Prevent duplicate imports

As an admin, I want imports to be idempotent so that the same batch is not processed twice.

Acceptance criteria:

- Batch idempotency key is generated from source period and file checksum.
- Duplicate batch submission is detected and blocked or safely ignored.
- Duplicate row keys are skipped and reported.

### Story 3.4: Persist accepted sale records

As a system, I want valid sales rows stored as normalized records so that downstream ledger operations are traceable.

Acceptance criteria:

- Accepted rows create SaleRecord entries.
- Each sale record stores source batch reference and row key.
- Persisted sale records can be queried by vendor and source period.

### Story 3.5: Produce import summary and audit trail

As an admin, I want a final import summary so that I can verify what happened during processing.

Acceptance criteria:

- Import result includes accepted, rejected, and duplicate counts.
- Row-level validation errors are stored or retrievable.
- Import action emits audit events.

## Epic 4: Ledger and Balance Engine

Goal:
Implement the financial source of truth using append-only ledger entries and derived balances.

### Story 4.1: Create ledger entries from imported sales

As a system, I want accepted sales to create ledger entries so that balances are derived from auditable transactions.

Acceptance criteria:

- Each accepted sale creates one or more ledger entries as required by the business rules.
- Ledger entries reference vendor, source type, and source record.
- Ledger creation is deterministic and repeat-safe.

### Story 4.2: Calculate vendor balances

As a vendor, I want my balance to reflect ledger activity accurately so that I can trust what is available for payout.

Acceptance criteria:

- Pending, available, and paid balances are derived from ledger entries.
- Balance calculations use fixed-precision decimal values.
- Recalculation produces the same result for the same data set.

### Story 4.3: Store balance snapshots

As a system, I want optional balance snapshots so that balance reads remain efficient as data volume grows.

Acceptance criteria:

- Balance snapshots can be generated from ledger data.
- Snapshot data includes pending, available, paid, and asOf values.
- Snapshot use does not replace the ledger as source of truth.

### Story 4.4: Support balance reconciliation

As an admin, I want to reconcile balances against source transactions so that discrepancies can be investigated.

Acceptance criteria:

- Admin can trace a balance back to ledger entries and source sales.
- Ledger entries preserve source references.
- Reconciliation workflow does not require manual editing of balances.

## Epic 5: Vendor Financial Portal

Goal:
Give vendors transparent access to their sales, ledger, balances, and payout history.

### Story 5.1: View sales history

As a vendor, I want to view my sales history so that I can understand what activity contributed to my balance.

Acceptance criteria:

- Vendor can see sale records scoped to their account.
- Sales list supports source period or date filtering.
- Vendor cannot see records belonging to other vendors.

### Story 5.2: View ledger history

As a vendor, I want to view my ledger entries so that I can understand how my balance changed over time.

Acceptance criteria:

- Vendor can see ledger entries scoped to their account.
- Ledger entries include reference information and amounts.
- Entries are ordered in a predictable way.

### Story 5.3: View balance summary

As a vendor, I want to view pending, available, and paid totals so that I can understand my account status.

Acceptance criteria:

- Vendor dashboard displays pending, available, and paid amounts.
- Balance values match ledger-derived calculations.
- Balance summary updates after imports and payout events.

### Story 5.4: View payout request history

As a vendor, I want to view my payout request history so that I can track the outcome of my requests.

Acceptance criteria:

- Vendor can see all payout requests associated with their account.
- Each request displays amount, status, and timestamps.
- Vendor cannot view payout requests belonging to others.

## Epic 6: Vendor Payout Requests

Goal:
Allow vendors to submit payout requests against available balance while preserving financial integrity.

### Story 6.1: Submit payout request

As a vendor, I want to submit a payout request so that I can receive funds owed to me.

Acceptance criteria:

- Vendor can submit a request for an amount less than or equal to available balance.
- Submitted request is created in requested status.
- Request is associated with the correct vendor account.
- Request for zero or negative amount is rejected with a validation error.
- Rate limiting of 10 requests per hour per vendor is enforced.

### Story 6.2: Reject invalid payout request amounts

As a system, I want to reject invalid payout request amounts so that balances are not overdrawn.

Acceptance criteria:

- Request greater than available balance is rejected.
- Zero or negative request amounts are rejected.
- Rejection returns a clear business validation error.

### Story 6.3: Show payout request status changes

As a vendor, I want payout status updates reflected in the portal so that I know what action has been taken.

Acceptance criteria:

- Vendor can see statuses including requested, approved, rejected, disbursing, paid, and failed.
- Status changes are reflected in payout history.
- Relevant timestamps are preserved.

## Epic 7: Admin Payout Review and Disbursement

Goal:
Allow admins to review payout requests, apply approval decisions, and execute disbursements through supported methods.

### Story 7.1: Review payout request queue

As an admin, I want a queue of payout requests so that I can process them efficiently.

Acceptance criteria:

- Admin can view requested and in-progress payout requests.
- Queue shows vendor, amount, status, and timestamps.
- Queue can distinguish requests requiring action.

### Story 7.2: Approve payout request

As an admin, I want to approve a payout request so that disbursement can proceed.

Acceptance criteria:

- Approved request moves from requested to approved.
- Approved amount is reserved from available balance.
- Approval action stores reviewer identity and time.

### Story 7.3: Reject payout request

As an admin, I want to reject a payout request so that invalid or exceptional cases can be stopped.

Acceptance criteria:

- Rejected request moves from requested to rejected.
- Rejection reason is stored.
- Rejection does not reduce paid totals.

### Story 7.4: Create PayPal disbursement

As an admin, I want to record a PayPal payout so that approved requests can be fulfilled through a supported method.

Acceptance criteria:

- Admin can create a disbursement for an approved request with methodType paypal.
- Provider reference and timestamp are stored.
- Payout status transitions through disbursing to paid or failed.

### Story 7.5: Create Venmo disbursement

As an admin, I want to record a Venmo payout so that approved requests can be fulfilled through a supported method.

Acceptance criteria:

- Admin can create a disbursement for an approved request with methodType venmo.
- Provider reference and timestamp are stored.
- Payout status transitions through disbursing to paid or failed.

### Story 7.6: Handle failed disbursement

As a system, I want failed disbursements to restore reserved funds so that vendor balances remain correct.

Acceptance criteria:

- Failed disbursement moves payout status to failed.
- Reserved amount is returned to available balance.
- Failure reason is stored and visible to admins.

### Story 7.7: Reject unsupported payout methods

As a system, I want unsupported payout methods rejected so that only approved MVP workflows are used.

Acceptance criteria:

- Any methodType other than paypal or venmo is rejected.
- Rejection returns a clear validation error.
- No disbursement record is created for unsupported methods.

## Epic 8: Notifications and Audit Visibility

Goal:
Make important system actions observable to users and support operational traceability.

### Story 8.1: Send authentication-related emails

As a system, I want to send authentication-related emails so that vendors can access or recover their accounts.

Acceptance criteria:

- Authentication-related email events can be triggered by the auth flow.
- Emails are sent through the configured email provider.
- Failures are logged for operational review.

### Story 8.2: Send payout request confirmation

As a vendor, I want confirmation when I submit a payout request so that I know the system received it.

Acceptance criteria:

- Request confirmation email is triggered when payout request is created.
- Email includes request amount and status context.
- Delivery attempt is logged.

### Story 8.3: Send payout decision notifications

As a vendor, I want to be informed when my payout request is approved or rejected so that I know the outcome.

Acceptance criteria:

- Approval triggers an approval notification.
- Rejection triggers a rejection notification.
- Notifications include the latest payout status.

### Story 8.4: Send payout completion and failure notifications

As a vendor, I want to know whether a payout was completed or failed so that I can follow up when needed.

Acceptance criteria:

- Paid status triggers a completion email.
- Failed status triggers a failure email.
- Notification events are logged.

### Story 8.5: View audit activity

As an admin, I want to inspect audit records so that I can trace critical system actions.

Acceptance criteria:

- Admin can view audit events for vendor changes, imports, approvals, rejections, and disbursements.
- Audit records include actor, action, entity, and timestamp.
- Audit data is queryable without modifying source records.

## Epic 9: Operational Hardening and Release Readiness

Goal:
Ensure the MVP is safe to run in production and supportable during real operations.

### Story 9.1: Add structured logging and request tracing

As an operator, I want structured logs and request IDs so that failures can be debugged quickly.

Acceptance criteria:

- API requests emit logs with request IDs.
- Critical workflow steps emit structured logs.
- Error logs contain enough context for investigation.

### Story 9.2: Add monitoring and alerts

As an operator, I want alerts for critical failures so that issues are noticed quickly.

Acceptance criteria:

- Failed imports generate operational alerts.
- Failed disbursements generate operational alerts.
- Authentication anomalies can be surfaced for review.

### Story 9.3: Document backup and recovery expectations

As an operator, I want backup and recovery procedures defined so that data loss events can be handled responsibly.

Acceptance criteria:

- Backup expectations are documented.
- Restore expectations align with target RPO and RTO.
- Production readiness checklist includes recovery validation.

### Story 9.4: Gate release on critical workflow coverage

As a team, I want a release gate for critical workflows so that financially risky changes do not ship unverified.

Acceptance criteria:

- Critical unit, integration, and end-to-end tests are identified.
- Deployment criteria require those tests to pass.
- Release readiness includes confirmation of audit, logging, and payout workflow health.

## Deferred Epics

These are not part of MVP but are likely future backlog candidates:

- Vendor self-service payment method management
- Vendor-initiated payout cancellation
- Automated payout scheduling and execution
- Advanced commission configuration workflows
- Analytics dashboards and export-driven reporting
- POS integration
- Mobile-specific client experiences
- Inventory management for unsold items
