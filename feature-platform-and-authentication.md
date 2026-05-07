# Platform and Authentication Features

## Summary

The Platform and Authentication Features provide secure vendor access to the self-service portal, including authentication, authorization, and automatic account linking capabilities.

## Goals

- Secure vendor authentication with email/password credentials
- Account activation/deactivation controls to manage vendor access
- Password recovery flow for self-service credential reset
- Automatic vendor account linking through email matching with pre-approved vendors
- Vendor-scoped data access ensuring vendors only see their own records
- Secure admin authentication with dedicated identity lifecycle and route protection

## Requirements

- Secure vendor login using email and password credentials
- Access only vendor-scoped data on authenticated requests
- Deny access when vendor account is in inactive status
- Password reset via time-limited email token (24-hour expiry)
- Automatic vendor account linking when registration email matches an ApprovedVendor email
- Account lockout after 10 consecutive failed login attempts with 30-minute auto-unlock
- Password hashing using bcrypt with cost factor >= 12
- Session expiration and re-authentication for sensitive actions
- Store admin accounts separately from vendor accounts with unique admin email
- Secure admin login using dedicated admin auth endpoints
- Deny admin access when admin account is disabled
- Admin password reset via time-limited email token (24-hour expiry)
- Admin account lockout after 10 consecutive failed login attempts with 30-minute auto-unlock
- One-time bootstrap workflow to create the initial admin account
- Audit logging for admin account lifecycle and authentication events

## Constraints & Assumptions

- All admins have full admin privileges with no role differentiation
- Vendor email addresses must be unique across all vendor accounts
- ApprovedVendor email can match Vendor email for automatic account linking during registration
- Authentication endpoints rate limited to 5 attempts per 15 minutes per IP/email
- Session management required for sensitive operations
- Admin and vendor identities do not share account records

## Edge Cases

- Vendor attempts login with correct credentials but inactive account status
- Password reset token expires before use
- Multiple failed login attempts leading to account lockout
- Registration email matches multiple ApprovedVendor records (should not occur due to unique email constraint)
- Vendor already has account but registers with matching ApprovedVendor email
- Admin login attempted before initial bootstrap account exists
- Disabled admin account attempts authentication
- Admin reset token expires before use

## Implementation Steps

1. **Authentication Infrastructure**
   - Set up JWT-based authentication configuration with secure secrets
   - Configure bcrypt password hashing with cost factor >= 12
   - Implement session management and token expiration
   - Create auth middleware for route protection

   **Tests:**
   - Unit test for password hashing with correct cost factor
   - Unit test for JWT token generation and verification
   - Integration test for protected route access without valid token

2. **Vendor Login Endpoint**
   - Implement POST /api/vendor/login endpoint
   - Validate credentials against hashed password
   - Check vendor status is active
   - Generate and return JWT token
   - Implement rate limiting (5 attempts per 15 minutes)
   - Track failed attempts and implement lockout logic

   **Tests:**
   - Integration test for successful login with valid credentials
   - Integration test for rejected login with inactive account
   - Integration test for rate limiting after 5 failed attempts
   - Integration test for account lockout after 10 failures

3. **Password Reset Flow**
   - Implement password reset request endpoint
   - Generate time-limited token (24-hour expiry)
   - Send password reset email via Mailgun
   - Implement token validation endpoint
   - Implement password update endpoint
   - Invalidate token after use

   **Tests:**
   - Integration test for password reset email generation
   - Integration test for password reset with valid token
   - Integration test for rejected reset with expired token
   - Unit test for token expiry validation (24 hours)

4. **Registration and Automatic Account Linking**
   - Implement POST /api/vendor/register endpoint
   - Validate unique email constraint against existing vendors
   - Check if email matches ApprovedVendor record
   - Auto-link vendor account to ApprovedVendor on registration match
   - Create audit event for new vendor registration
   - Generate access setup email for newly registered vendors

   **Tests:**
   - Integration test for successful registration with matching ApprovedVendor
   - Integration test for successful registration without ApprovedVendor match
   - Integration test for rejected registration with duplicate email
   - Unit test for ApprovedVendor matching logic

5. **Rate Limiting and Security Middleware**
   - Implement rate limiting middleware for auth endpoints
   - Create account lockout tracking mechanism
   - Add IP-based rate limiting (5 auth attempts per 15 minutes)
   - Implement auto-unlock after 30 minutes
   - Add admin unlock capability for locked accounts

   **Tests:**
   - Unit test for rate limiting counter increment
   - Integration test for 30-minute auto-unlock
   - Integration test for rate limit exceeded response

6. **Vendor-Scoped Authorization Middleware**
   - Create middleware to extract vendor ID from JWT token
   - Implement database query scoping by vendor ID
   - Add route-level vendor access validation
   - Implement session expiration checks

   **Tests:**
   - Unit test for vendor ID extraction from token
   - Integration test for vendor-scoped data access enforcement
   - Integration test for session expiration handling

7. **Session Management and Token Refresh**
   - Implement JWT token expiration (configurable duration)
   - Add token refresh endpoint for active sessions
   - Implement sensitive action re-authentication
   - Add logout endpoint to invalidate tokens

   **Tests:**
   - Integration test for token refresh flow
   - Integration test for expired token rejection
   - Integration test for logout token invalidation

8. **Admin Authentication Endpoints**
   - Implement POST /api/admin/login endpoint
   - Validate admin credentials against dedicated admin account model
   - Enforce admin account status and lockout checks
   - Generate and return admin-role JWT token
   - Implement rate limiting (5 attempts per 15 minutes)

   **Tests:**
   - Integration test for successful admin login with active account
   - Integration test for rejected admin login with disabled account
   - Integration test for admin lockout after repeated failed attempts

9. **Admin Account Lifecycle and Bootstrap**
   - Implement one-time bootstrap flow for initial admin account creation
   - Add admin password reset request and password update endpoints
   - Add admin account status update and unlock operations
   - Record audit events for admin auth and lifecycle events

   **Tests:**
   - Integration test for bootstrap creating first admin only once
   - Integration test for admin password reset token validation and invalidation
   - Integration test for admin status toggle affecting login eligibility

## Status Overview (as of 2026-05-07)

### Overall Status

- Core platform/authentication implementation is mostly complete and operational.
- Vendor authentication and portal access flows are implemented and tested.
- Admin authentication now has a dedicated account model and initial endpoints, but full admin lifecycle flows are not yet complete.

### Completed

- JWT auth configuration and bcrypt-based password hashing (cost factor >= 12).
- Vendor auth middleware for protected vendor API routes.
- Login endpoint with rate limiting and account lockout handling.
- Lockout auto-unlock behavior after lockout duration.
- Registration with automatic ApprovedVendor linking by email.
- Password reset request, token verification, and password update endpoints.
- Token refresh endpoint for active sessions.
- Logout endpoint with token revocation and audit event creation.
- Shared token revocation infrastructure using Redis when configured, with in-memory fallback.
- Vendor login and registration pages in the app.
- Header-level logout button and auth-aware navigation.
- AdminAccount model with dedicated admin identity fields (adminId, email, password hash, status, lockout/reset metadata).
- Dedicated admin login endpoint with rate limiting, lockout handling, disabled-account enforcement, JWT issuance, and admin_login audit events.
- Dedicated admin profile endpoint (GET /api/admin/me) guarded by admin-role token validation.
- JWT/admin auth semantics updated so admin identity uses adminId (not vendorId).
- Integration tests for admin login (active success, disabled rejection) and admin profile retrieval.

### Partially Complete

- Session invalidation is implemented, but distributed behavior depends on REDIS_URL being configured.
- Sensitive action re-authentication is not yet fully defined or enforced beyond token checks.
- Admin account lockout auto-unlock behavior exists via shared lockout config, but broader admin lifecycle controls are still incomplete.

### Gap Identified

- Full admin account lifecycle is not yet implemented end-to-end (bootstrap, reset/update password, refresh/logout, unlock/status operations).

### Pending

- Admin bootstrap workflow for first account creation.
- Dedicated admin auth endpoints beyond login/me (refresh, logout, reset-password, update-password).
- Admin account status update and unlock operations.
- Admin unlock capability for locked vendor accounts.
- Mailgun-backed email delivery in auth flows (reset/register still include TODO placeholders in route handlers).
- Broader route-level integration tests for endpoint behavior (beyond utility/model focused coverage).

### Verification Status

- Last full verification run:
  - Lint: passing
  - Typecheck: passing
  - Unit tests: passing
  - Integration tests: passing
  - Coverage run: passing
  - Build: passing
  - E2E: passing (auth page smoke coverage added)
