# Vendor Financial Views and Payout Features

## Summary

The Vendor Financial Views and Payout Features provide vendors with transparent access to their financial data through sales history, ledger entries, balance summaries, and payout request management. Vendors can view their financial status and submit payout requests against their available balance.

## Goals

- Expose vendor financial data clearly and safely through dedicated views
- Allow vendors to submit payout requests against available balance only
- Provide transparent visibility into sales, ledger, balances, and payout history
- Ensure financial correctness through validation of payout requests

## Requirements

### Vendor Financial Visibility

- View sales history derived from imported records
- View ledger history with financial references
- View balance summary split by pending, available, and paid amounts
- View payout request history and statuses

### Vendor Payout Requests

- Submit payout requests against available balance only
- Receive validation feedback for insufficient balance or invalid state
- See request progress through requested, approved, rejected, disbursing, paid, or failed states
- Payout amounts must be positive (greater than zero)

## Constraints & Assumptions

- Payout amounts must be positive (greater than zero)
- No minimum or maximum payout amount limits in MVP
- Available balance is derived from ledger entries, not manually editable
- Imported sales become available immediately after successful import commit
- Payout requests reserved funds affect available balance
- Balance calculations use fixed-precision decimals, never floating point
- All amounts are in USD
- Rate limiting: 10 payout requests per hour per vendor

## Edge Cases

- Vendor submits payout request with zero amount
- Vendor submits payout request with negative amount
- Vendor submits payout request exceeding available balance
- Vendor submits payout request when no balance exists
- Multiple concurrent payout requests from same vendor
- Payout request created just before balance changes from new import
- Vendor views payout request that has been rejected or failed

## Implementation Steps

### 1. Sales History View

- Implement GET /api/vendor/sales endpoint
- Query SaleRecord collection scoped to authenticated vendor
- Support optional filtering by source period or date range
- Return vendor-visible transaction details (title, quantity, unit, discount, extended)
- Return results ordered by soldAt timestamp descending

**Tests:**

- Unit test for SaleRecord query by vendor scoping
- Integration test for vendor viewing own sales history
- Integration test for vendor denied access to other vendor sales
- Integration test for date range filtering

### 2. Ledger History View

- Implement GET /api/vendor/ledger endpoint
- Query LedgerEntry collection scoped to authenticated vendor
- Include reference information linking to sale records where applicable
- Return entryType, amount, balanceImpact, reference, and timestamp
- Order entries chronologically for predictable display

**Tests:**

- Unit test for LedgerEntry query structure
- Integration test for vendor viewing own ledger entries
- Integration test for ledger entry includes reference to sale record
- Integration test for chronological ordering

### 3. Balance Summary View

- Implement GET /api/vendor/balance endpoint
- Calculate pending, available, and paid amounts from ledger entries
- Use fixed-precision decimal arithmetic for all calculations
- Return balance values that match ledger-derived state
- Cache or snapshot balance for performance optimization (optional)

**Tests:**

- Unit test for balance calculation from ledger entries
- Unit test for decimal precision in balance calculations
- Integration test for vendor viewing balance summary
- Integration test for balance matching ledger-derived values

### 4. Payout Request History

- Implement GET /api/vendor/payout-requests endpoint
- Query PayoutRequest collection scoped to authenticated vendor
- Include all statuses: requested, approved, rejected, disbursing, paid, failed
- Return amount, status, createdAt, updatedAt, and related timestamps
- Order by creation date descending

**Tests:**

- Unit test for PayoutRequest query by vendor scoping
- Integration test for vendor viewing own payout request history
- Integration test for payout statuses displayed correctly
- Integration test for multiple payout requests ordering

### 5. Payout Request Submission

- Implement POST /api/vendor/payout-requests endpoint
- Validate payout amount is positive (> 0)
- Validate payout amount does not exceed available balance
- Create PayoutRequest in requested status
- Associate request with authenticated vendor account
- Return validation error for insufficient balance
- Enforce rate limiting of 10 requests per hour per vendor

**Tests:**

- Unit test for available balance calculation logic
- Unit test for payout amount validation (positive, within balance)
- Integration test for successful payout request creation
- Integration test for rejected payout with zero amount
- Integration test for rejected payout with negative amount
- Integration test for rejected payout exceeding available balance
- Integration test for rate limiting after 10 requests per hour

### 6. Payout Status Tracking

- Implement status enum with values: requested, approved, rejected, disbursing, paid, failed
- Update vendor payout history view to reflect status changes
- Store status change timestamps in PayoutRequest
- Ensure status transitions are valid and enforced in service layer

**Tests:**

- Unit test for valid status transitions
- Unit test for status enum values
- Integration test for payout status displayed in history
- Integration test for status timestamps recorded correctly

## API Error Codes

- PAYOUT_INVALID_AMOUNT - Requested amount is zero or negative.
- PAYOUT_INSUFFICIENT_AVAILABLE_BALANCE - Requested amount exceeds available balance.
- PAYOUT_INVALID_STATE_TRANSITION - Requested operation is not allowed for current payout status.
- AUTH_VENDOR_SCOPE_VIOLATION - Vendor attempted to access another vendor's records.
- AUTH_RATE_LIMITED - Payout request rate limit exceeded.
- AUTH_TOKEN_EXPIRED - Session token is expired or invalid.

## Status Overview (as of 2026-05-07)

### Overall Status

- Planned and not yet implemented end-to-end.
- Endpoint contracts and validation behavior are documented.

### Pending

- Vendor sales, ledger, and balance endpoints.
- Vendor payout-request list and create endpoints.
- Balance derivation wiring to ledger entries.
- Payout history rendering and status timestamp coverage.
- Integration tests for payout validations and vendor scoping.

### Verification Status

- Implementation verification pending until endpoints and data models are added.
