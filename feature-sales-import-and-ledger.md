# Sales Import and Ledger Features

## Summary

The Sales Import and Ledger Features handle quarterly CSV file uploads, validate and process sales data, map sales to vendors via ApprovedVendor records, and maintain an append-only ledger for financial correctness and auditability.

## Goals

- Safely import quarterly sales data from ReportSalesDetail CSV files
- Validate CSV structure and data, providing row-level error reporting
- Map sales to vendors using Source column matching against ApprovedVendor records
- Maintain idempotent imports with batch-level and row-level deduplication
- Create ledger entries for all accepted sales rows
- Ensure financial correctness through append-only accounting

## Requirements

- Upload quarterly CSV files in ReportSalesDetail format
- Parse and validate the fixed input format regardless of which fields are stored
- Extract fields: Date+Time (soldAt), Source (for vendor mapping), Extended (grossAmount), Discount (commissionAmount), Cost, Credit
- Extract vendor-visible transaction details: Title (item description), Quantity, Unit (per item cost)
- Map Source column to ApprovedVendor records (concatenation of first_name + last_name)
- Link sales to vendor accounts via ApprovedVendor mapping
- Calculate ledger amount from max(Cost, Credit) for correct payout
- Reject malformed imports with row-level validation errors
- Deduplicate rows using a deterministic item-level row key
- Prevent duplicate full-batch imports using a batch idempotency key
- Produce an import summary with accepted, rejected, and duplicate counts
- Create ledger entries from accepted sales rows with transaction details
- All financial changes are append-only ledger entries
- Balances are derived from ledger data rather than manually edited
- Paid, pending, and available amounts are calculated deterministically
- Imported net sales increase vendor balance and become available immediately after successful import commit
- Re-uploading the same batch must not double-credit vendors
- Import processing must be safe to retry

## Constraints & Assumptions

- All amounts are in USD using fixed-point decimal arithmetic
- Monetary values use fixed-precision decimals, never float
- Source column format is first_name + " " + last_name (concatenation)
- Currency is fixed as USD; currency field in imports must be "USD"
- Batch idempotency key uses source period plus uploaded file checksum
- Row dedupe key uses a deterministic fingerprint of each sold item row, not Sale/Order ID alone
- File upload limits: 10MB max CSV size, 5000 rows max per batch
- Re-uploading the same batch must not double-credit vendors
- Ledger amount is derived from max(Cost, Credit) columns
- saleOrderId is a source-system reference only and remains admin-only for POS lookup
- Title, Quantity, Unit, Discount, Extended are vendor-visible for transparency

## Edge Cases

- CSV with missing required columns
- Rows with unparseable dates or times
- Source column that doesn't match any ApprovedVendor record
- Duplicate row detection within same batch
- Duplicate batch detection on re-upload
- Negative amounts in financial fields
- Malformed decimal values in amount fields
- Empty or whitespace-only Source values
- Currency field not equal to USD

## Implementation Steps

1. **CSV Upload and Storage**
   - Implement POST /api/admin/sales/imports endpoint
   - Validate file size (10MB max) and row count (5000 max)
   - Store uploaded file temporarily for processing
   - Generate file checksum for batch idempotency key

   **Tests:**
   - Integration test for successful upload with valid CSV
   - Integration test for rejection when file exceeds size limit
   - Integration test for rejection when rows exceed count limit

2. **CSV Parsing and Validation**
   - Parse ReportSalesDetail format with all columns
   - Validate required columns present (Date, Time, Source, Extended, Discount, Cost, Credit, Title, Quantity, Unit, Sale/Order ID)
   - Validate amount fields are valid non-negative decimals
   - Validate Quantity is a positive integer
   - Validate Unit is a valid decimal value
   - Validate Date and Time parseable to soldAt timestamp
   - Validate Source matches ApprovedVendor pattern (first_name + " " + last_name)
   - Validate currency is USD

   **Tests:**
   - Unit test for CSV parser with valid format
   - Unit test for missing required column rejection
   - Unit test for invalid decimal rejection
   - Unit test for unparseable date rejection
   - Unit test for invalid quantity rejection
   - Unit test for invalid unit value rejection
   - Unit test for missing Sale/Order ID rejection

3. **Vendor Mapping and Row Processing**
   - Parse Source column to match ApprovedVendor records
   - Resolve vendorId from Source via ApprovedVendor mapping
   - Generate a unique application-level identity for each sold item row
   - Create sourceRowKey from a deterministic fingerprint of each sold item row
   - Extract vendor-visible transaction details: Title, Quantity, Unit, Discount, Extended
   - Store admin-only saleOrderId for POS lookup
   - Skip and report rows with unmapped Source values
   - Track accepted, rejected, and duplicate counts

   **Tests:**
   - Unit test for Source parsing and ApprovedVendor matching
   - Unit test for sourceRowKey generation
   - Integration test for unmapped Source reporting
   - Unit test for vendor-visible fields extraction
   - Unit test for saleOrderId storage (admin-only)

4. **Idempotency and Deduplication**
   - Compute batch idempotency key from source period and file checksum
   - Check for existing batch to prevent duplicate imports
   - Check for duplicate row keys within batch
   - Mark duplicate rows as skipped in import summary

   **Tests:**
   - Integration test for duplicate batch rejection
   - Integration test for duplicate row skipping within batch
   - Unit test for batch idempotency key generation

5. **Ledger Entry Creation**
   - Create SaleRecord for each accepted row with vendorId (includes title, quantity, unit, discount, extended)
   - Store admin-only saleOrderId for POS lookup
   - Calculate ledger amount as max(Cost, Credit)
   - Create LedgerEntry for each sale with entryType "sale" that references the SaleRecord's application-level identity via referenceId
   - Set entry amount to calculated value (max of Cost or Credit) - THIS affects vendor balance
   - Vendor-visible fields (title, quantity, unit, discount, extended) are fetched from linked SaleRecord
   - Store timestamp from soldAt

   **Tests:**
   - Unit test for SaleRecord creation with all transaction details
   - Unit test for LedgerEntry creation with max(Cost, Credit) amount
   - Unit test for LedgerEntry referencing correct SaleRecord
   - Unit test for admin-only saleOrderId storage
   - Integration test for multiple sales creating correct ledger entries
   - Integration test that vendor balance increases after import
   - Integration test that vendor sees correct transaction details in ledger view

6. **Import Summary Reporting**
   - Return import summary with total, accepted, rejected, duplicate counts
   - Include error report with row number, reason, and remediation hint
   - Report unmapped Source values for vendor list maintenance
   - Create AuditEvent for import completion

   **Tests:**
   - Integration test for summary with mixed valid/invalid rows
   - Integration test for error report format
   - Integration test for audit event creation

## API Error Codes

- IMPORT_INVALID_FILE_FORMAT - Uploaded file is not a valid ReportSalesDetail CSV.
- IMPORT_MISSING_REQUIRED_COLUMN - One or more required columns are missing.
- IMPORT_INVALID_ROW_DATA - A row has invalid date/time, amount, quantity, or unit values.
- IMPORT_DUPLICATE_BATCH - Batch idempotency key already exists.
- IMPORT_DUPLICATE_ROW - Item-level row dedupe key already processed.
- IMPORT_UNMAPPED_SOURCE - Source value cannot be mapped to an ApprovedVendor.
- AUTH_FORBIDDEN_ADMIN_REQUIRED - Caller is not an authenticated admin.

## Status Overview (as of 2026-05-07)

### Overall Status

- Planned and not yet implemented end-to-end.
- Contract and rules are documented, but import, ledger, and balance models are still pending.

### Pending

- Sales import endpoints and pipeline implementation.
- SaleRecord, LedgerEntry, and BalanceSnapshot model implementation.
- Import idempotency and deduplication persistence.
- Vendor mapping and import summary reporting.
- Route-level integration tests for malformed, duplicate, and successful imports.

### Verification Status

- Implementation verification pending until routes and models are added.
