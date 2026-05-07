# Operational Features

## Summary

The Operational Features provide the infrastructure and tooling needed to run the consignment management system safely in production, including transactional email notifications, observability through structured logging and monitoring, backup and recovery capabilities, and release readiness validation.

## Goals

- Enable reliable communication with vendors through transactional emails
- Provide observability for debugging and operational monitoring
- Support backup, recovery, and safe deployment practices
- Ensure auditability of all critical system actions

## Requirements

### Transactional Email Notifications

- Authentication-related emails as configured for access setup or recovery
- Payout request confirmation emails
- Payout approval and rejection emails
- Payout completion and failure emails

### Monitoring and Controls

- Structured logs for import and payout workflows
- Alerting for failed imports, failed disbursements, and authentication anomalies
- Typed environment configuration with startup validation
- Backup and recovery support consistent with the spec

## Constraints & Assumptions

- Email delivery through configured provider (Mailgun in MVP)
- All emails include relevant context (amounts, statuses, timestamps)
- Logging includes request IDs for traceability
- Environment validation fails fast on missing required settings
- Backup procedures must support 7-year financial record retention
- Recovery procedures align with documented RPO/RTO targets

## Operational Runbook Summary

- Ownership:
  - Engineering owns logging, alert rules, and on-call response paths.
  - Operations owns backup scheduling, restore drills, and retention checks.
  - Security/Privacy owner approves PII anonymization requests and audit review.
- Cadence:
  - Backup restore drill: monthly.
  - Alert rule review and tuning: bi-weekly.
  - Environment configuration audit: each release and monthly baseline review.
  - PII anonymization workflow review: quarterly.
- Escalation:
  - P1 (financial data integrity or payout outage): page on-call immediately, escalate to engineering lead within 15 minutes.
  - P2 (degraded imports/disbursements): notify on-call and operations channel, escalate within 1 hour if unresolved.
  - P3 (non-blocking notification or logging issues): create incident ticket and resolve in next sprint.
- Evidence and audit artifacts:
  - Store restore drill results, alert incident timelines, and anonymization approvals in an operations log repository.

## Edge Cases

- Email fails to send after successful operation completes
- Environment validation fails on startup with missing/invalid config
- Log volume exceeds storage capacity during high activity periods
- Alert storms from cascading failures
- Backup process interrupted mid-execution
- Recovery attempted with outdated backup media

## Implementation Steps

### 1. Email Infrastructure

- Configure Mailgun or other email provider integration
- Create email template system for consistent messaging
- Implement email queuing for reliable delivery
- Add delivery attempt logging and retry logic
- Store email metadata for audit purposes

**Tests:**

- Unit test for email template rendering
- Integration test for email delivery through provider
- Integration test for delivery attempt logging
- Integration test for email queue processing

### 2. Authentication-Related Emails

- Trigger email on vendor registration
- Trigger email on password reset request
- Trigger email on password reset completion
- Include time-limited tokens where applicable
- Include secure links for account access/setup

**Tests:**

- Unit test for password reset email generation
- Integration test for registration email delivery
- Integration test for password reset token expiry (24 hours)

### 3. Payout Confirmation Emails

- Trigger email on payout request creation
- Include request amount and status context
- Include expected timeline for processing
- Log delivery attempt for audit trail

**Tests:**

- Integration test for payout request confirmation email
- Integration test for email includes correct amount
- Integration test for delivery attempt logged

### 4. Payout Decision Emails

- Trigger approval email when payout is approved
- Trigger rejection email when payout is rejected
- Include reason for rejection where provided
- Include updated payout status in all cases

**Tests:**

- Integration test for approval notification email
- Integration test for rejection notification email
- Integration test for rejection reason included

### 5. Payout Completion and Failure Emails

- Trigger email when payout transitions to paid status
- Trigger email when payout transitions to failed status
- Include provider reference for paid transactions
- Include failure reason for failed transactions
- Include next steps guidance for failures

**Tests:**

- Integration test for payout completion email
- Integration test for payout failure email
- Integration test for provider reference in completion email

### 6. Structured Logging Infrastructure

- Add request ID tracking through middleware
- Create structured log format for API requests
- Log critical workflow steps with context
- Include actor identity and timestamp in logs
- Ensure error logs contain investigation context

**Tests:**

- Unit test for request ID generation
- Integration test for structured log format
- Integration test for request-scoped log correlation
- Integration test for error context inclusion

### 7. Monitoring and Alerting

- Create alert for failed import detection
- Create alert for failed disbursement detection
- Create alert for authentication anomalies
- Configure alert routing to operational channels
- Add alert de-duplication and rate limiting

**Tests:**

- Unit test for failed import alert trigger
- Unit test for failed disbursement alert trigger
- Integration test for authentication anomaly detection
- Integration test for alert de-duplication

### 8. Environment Configuration

- Define required environment variables
- Add startup validation for all required settings
- Create typed configuration module
- Support local, staging, and production environments
- Add clear error messages for missing/invalid config

**Tests:**

- Unit test for environment validation
- Unit test for typed config access
- Integration test for startup failure with missing config

### 9. Backup and Recovery

- Document backup procedures for MongoDB
- Define RPO/RTO targets for financial data
- Test backup restoration process
- Ensure 7-year retention for financial records (GDPR compliance)
- Document PII anonymization workflow for deletion requests

**Tests:**

- Integration test for backup process execution
- Integration test for data recovery validation
- Integration test for retention policy enforcement

### 10. Release Readiness Validation

- Identify critical unit tests for release gate
- Identify critical integration tests for release gate
- Identify critical end-to-end tests for release gate
- Create deployment checklist including test verification
- Document audit, logging, and payout workflow health checks

**Tests:**

- Unit test for test identification and categorization
- Integration test for deployment criteria verification

## API/Error Codes

- CONFIG_MISSING_REQUIRED_ENV - Required environment variable missing at startup.
- CONFIG_INVALID_VALUE - Environment variable is present but invalid.
- EMAIL_DELIVERY_FAILED - Email provider rejected or failed delivery.
- EMAIL_QUEUE_RETRY_EXHAUSTED - Email retries exceeded configured maximum.
- ALERT_DISPATCH_FAILED - Monitoring system failed to send alert notification.
- BACKUP_RESTORE_VALIDATION_FAILED - Restore drill completed with data mismatch.

## Status Overview (as of 2026-05-07)

### Overall Status

- Operational hardening is partially implemented.
- Core audit/import/payout visibility APIs now exist for admin operations.
- Email delivery, structured logging/alerts, and backup/recovery automation remain largely pending.

### Completed

- Audit events are emitted across major auth, vendor management, import, payout decision, and disbursement flows.
- Admin visibility endpoints implemented for:
  - Audit history (filterable).
  - Import status and error reporting (filterable).
  - Failed payout reconciliation details.
- Integration tests implemented for admin operations visibility endpoints.

### Partially Complete

- Environment configuration exists, but broader typed startup validation and operational policy enforcement are not fully comprehensive.
- Token revocation supports Redis when configured, with in-memory fallback for local/non-Redis contexts.

### Pending

- Mailgun-backed transactional emails for auth and payout lifecycle events.
- Structured request-id logging middleware and standardized operational log schema.
- Alert dispatching/integration for import failures, disbursement failures, and auth anomalies.
- Backup/restore automation, retention enforcement tooling, and recovery validation drills.
- Release-readiness checklist automation for operational controls.

### Verification Status

- Integration coverage exists for visibility endpoints and underlying workflow event creation.
- A fresh full-project verification run should be used as the release gate after remaining operational controls are implemented.
