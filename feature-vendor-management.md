# Vendor Management Features

## Summary

The Vendor Management Features provide comprehensive tools for administrators to manage vendor accounts throughout their lifecycle, from pre-approval through active management, while maintaining audit trails and enforcing business constraints.

## Goals

- Maintain an approved vendor database for pre-approval and sales mapping
- Provide admin CRUD operations for vendor accounts
- Support vendor account activation and deactivation
- Ensure email uniqueness across all vendor accounts
- Maintain complete audit trail of all vendor-related changes

## Requirements

- Maintain approved vendor database with basil_id, last_name, first_name, phone, and email
- Use approved vendor list for pre-approving vendors and mapping sales during import
- Create vendor accounts with required identity and contact fields
- Edit vendor profile and agreement metadata
- Activate or deactivate vendor access
- Maintain internal vendor identifiers and external identifiers used during imports
- Enforce unique email addresses across all vendor accounts
- Record audit events for all profile and status changes

## Constraints & Assumptions

- Vendor email addresses must be unique across all vendor accounts
- ApprovedVendor email can match Vendor email for automatic account linking during registration
- Admin users have full admin privileges with no role differentiation
- Vendor status controls access to the self-service portal
- All vendor mutations must emit audit events

## Edge Cases

- Vendor email already exists when creating new vendor account
- Vendor is in inactive status when admin attempts to edit profile
- Vendor profile edit has no actual changes
- ApprovedVendor record exists but vendor registration uses different email
- External identifier collision during import mapping

## Implementation Steps

1. **Approved Vendor CRUD Operations**
   - Implement GET /api/admin/approved-vendors endpoint
   - Implement POST /api/admin/approved-vendors endpoint
   - Implement PATCH /api/admin/approved-vendors/:id endpoint
   - Implement DELETE /api/admin/approved-vendors/:id endpoint
   - Validate unique email constraint on create/update

   **Tests:**
   - Unit test for ApprovedVendor schema validation
   - Integration test for create approved vendor
   - Integration test for rejected duplicate email
   - Integration test for update approved vendor fields

2. **Vendor Account Management Endpoints**
   - Implement POST /api/admin/vendors endpoint
   - Implement PATCH /api/admin/vendors/:vendorId endpoint
   - Implement GET /api/admin/vendors/:vendorId endpoint
   - Implement GET /api/admin/vendors list endpoint
   - Validate unique email constraint on vendor creation

   **Tests:**
   - Integration test for vendor creation with valid payload
   - Integration test for vendor creation with duplicate email rejection
   - Integration test for vendor profile update
   - Integration test for vendor status activation/deactivation

3. **Vendor Status Management**
   - Implement vendor status field (active/inactive)
   - Add middleware to check vendor status on login
   - Create audit event on status change
   - Implement account lockout check on authentication

   **Tests:**
   - Unit test for vendor status validation
   - Integration test for inactive vendor login rejection
   - Integration test for audit event creation on status change

4. **Audit Event Recording**
   - Create AuditEvent model and schema
   - Implement audit middleware for vendor operations
   - Record before/after values for tracked fields
   - Store actor ID, role, action, entity type, and entity ID

   **Tests:**
   - Unit test for audit event payload structure
   - Integration test for audit event on vendor create
   - Integration test for audit event on vendor update
   - Integration test for audit event on status change

5. **Identifier Management**
   - Implement internal vendorId generation
   - Add external identifier field support (basil_id)
   - Link ApprovedVendor basil_id to Vendor records
   - Support vendor lookup by both internal and external identifiers

   **Tests:**
   - Integration test for vendor creation with external ID
   - Integration test for vendor lookup by external ID
   - Integration test for identifier mapping during sales import