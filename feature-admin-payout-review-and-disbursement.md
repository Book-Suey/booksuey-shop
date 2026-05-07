# Admin Payout Review and Disbursement Features

## Summary

The Admin Payout Review and Disbursement Features allow administrators to review vendor payout requests, apply approval or rejection decisions, and execute disbursements through supported payment methods (PayPal and Venmo). The system enforces balance reservation rules and handles failed disbursements gracefully.

## Goals

- Provide admin tools to review and process vendor payout requests
- Enforce payout state transitions and balance reservation rules
- Execute disbursements through approved payment providers (PayPal, Venmo)
- Maintain audit trail for all payout decisions and disbursement outcomes
- Handle failed disbursements by returning reserved funds to available balance

## Requirements

### Payout Operations

- Review vendor payout requests in a dedicated admin queue
- Approve or reject payout requests with review metadata
- Prevent payout approval when balance is insufficient or request state is invalid
- Record disbursement details and outcome for approved requests
- Execute payouts using PayPal or Venmo only in MVP
- Store provider reference IDs and disbursement timestamps
- Return reserved funds to available balance if a disbursement fails
- All payout amounts are in USD with no minimum or maximum limits

### Audit and Operations Visibility

- View audit history for vendor changes, imports, payout decisions, and disbursements
- View import status and error reports
- View failed payout attempts and reconciliation details

## Constraints & Assumptions

- All amounts are in USD using fixed-point decimal arithmetic
- Payout methodType is restricted to paypal or venmo in MVP
- Payout state transitions must be enforced explicitly in the service layer
- Balance reservation occurs on approval and is released on rejection or failure
- Payout approval and disbursement writes must run in database transactions
- Status transitions must use expected prior-state checks at commit time
- Disbursement creation must be idempotent using payoutRequestId plus client idempotency key
- Admin users have full admin privileges with no role differentiation
- Disbursement records must include provider reference ID and timestamp
- Failed disbursements must trigger automatic balance restoration

## Edge Cases

- Admin attempts to approve payout when vendor balance has changed
- Multiple admins attempt to approve same payout request concurrently
- Disbursement fails after status moved to disbursing
- Invalid payout methodType provided (not paypal or venmo)
- Admin attempts to reject already approved payout
- Disbursement created with missing provider reference
- Failed disbursement when vendor has pending sales from new import
- Rejection of payout request that has already been approved

## Implementation Steps

### 1. Payout Request Queue

- Implement GET /api/admin/payout-requests endpoint
- Query PayoutRequest collection for requested and in-progress statuses
- Include vendor, amount, status, and timestamps in response
- Support filtering by status and date range
- Mark requests requiring action (requested status)

**Tests:**

- Unit test for PayoutRequest query by status
- Integration test for admin viewing payout queue
- Integration test for queue distinguishes requests needing action
- Integration test for filtering by date range

### 2. Payout Approval

- Implement POST /api/admin/payout-requests/:payoutId/approve endpoint
- Verify payout request exists and is in requested status
- Validate that vendor balance is sufficient for the payout amount
- Execute approval and reservation in a single database transaction
- Use conditional update requiring current status=requested
- Create ledger entry to reserve funds from available balance
- Update payout status to approved
- Store reviewer identity and approval timestamp
- Record audit event for approval action

**Tests:**

- Unit test for approval validation (status, balance check)
- Integration test for successful approval flow
- Integration test for rejected approval with insufficient balance
- Integration test for audit event on approval
- Integration test for reserved balance reduction

### 3. Payout Rejection

- Implement POST /api/admin/payout-requests/:payoutId/reject endpoint
- Verify payout request exists and is in requested status
- Update payout status to rejected
- Store rejection reason and reviewer metadata
- Rejection does not affect balance (no funds reserved yet)
- Record audit event for rejection action

**Tests:**

- Unit test for rejection validation
- Integration test for successful rejection flow
- Integration test for rejection reason storage
- Integration test for audit event on rejection

### 4. PayPal Disbursement

- Implement POST /api/admin/disbursements endpoint
- Validate payload includes payoutRequestId, methodType, and idempotencyKey
- Verify payout request is in approved status
- Validate methodType is paypal
- Execute disbursement transition and persistence in a single database transaction
- Create PaymentDisbursement record with provider reference
- Transition payout status to disbursing
- On success, transition to paid status
- On failure, transition to failed status and restore reserved balance
- Store disbursement outcome and timestamp

**Tests:**

- Unit test for PayPal disbursement validation
- Integration test for successful PayPal disbursement
- Integration test for failed PayPal disbursement with balance restoration
- Integration test for provider reference storage

### 5. Venmo Disbursement

- Reuse disbursement endpoint with methodType venmo
- Validate methodType is venmo
- Apply same success/failure flow as PayPal
- Store venmo-specific provider reference

**Tests:**

- Unit test for Venmo disbursement validation
- Integration test for successful Venmo disbursement
- Integration test for failed Venmo disbursement with balance restoration

### 6. PaymentDisbursement Model

- Create PaymentDisbursement schema with fields:
  - payoutRequestId (reference to PayoutRequest)
  - methodType (paypal or venmo)
  - providerReferenceId
  - amount
  - status (disbursing, paid, failed)
  - disbursedAt timestamp
  - failureReason (optional)

**Tests:**

- Unit test for PaymentDisbursement schema validation
- Unit test for methodType enum validation

### 7. Failed Disbursement Handling

- Detect failed disbursement through provider response or manual marking
- Update payout status to failed
- Create ledger entry to return reserved funds to available balance
- Store failure reason for operational visibility
- Notify relevant parties through notification system

**Tests:**

- Unit test for balance restoration calculation
- Integration test for failed disbursement flow
- Integration test for reserved balance returned to available

### 8. Unsupported Payment Method Rejection

- Validate methodType against allowed values (paypal, venmo)
- Reject any other methodType with clear validation error
- Prevent disbursement record creation for unsupported methods

**Tests:**

- Unit test for methodType validation
- Integration test for rejected unsupported method type
- Integration test for error response format

### 9. Audit and Operations Visibility

- Implement GET /api/admin/audit endpoint for audit history
- Include vendor changes, imports, payout decisions, and disbursements
- Support filtering by entity type and action
- Implement GET /api/admin/imports status endpoint
- Show failed import status and error reports
- Implement payout failure view with reconciliation details

**Tests:**

- Unit test for audit query structure
- Integration test for admin viewing audit history
- Integration test for audit filtering by action type
- Integration test for failed payout visibility

## API Error Codes

- PAYOUT_INVALID_STATE_TRANSITION - Approve/reject/disburse attempted from invalid status.
- PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE - Approval attempted without enough available funds.
- PAYOUT_CONCURRENT_MODIFICATION - Conditional update failed due to concurrent mutation.
- PAYOUT_UNSUPPORTED_METHOD - methodType is not paypal or venmo.
- DISBURSEMENT_PROVIDER_FAILURE - Provider call failed after transition to disbursing.
- DISBURSEMENT_DUPLICATE_REQUEST - Idempotency key already used for the same payout request.
- AUTH_FORBIDDEN_ADMIN_REQUIRED - Caller is not an authenticated admin.

## Status Overview (as of 2026-05-07)

### Overall Status

- Planned and not yet implemented end-to-end.
- Business flow and state machine are documented, with transactional requirements defined.

### Pending

- Admin payout-request queue endpoint.
- Approve/reject endpoints with transactional reservation logic.
- Disbursement endpoint and provider integration path.
- PaymentDisbursement model and idempotency persistence.
- Integration tests for concurrency, provider failure, and recovery paths.

### Verification Status

- Implementation verification pending until payout routes and models are added.
