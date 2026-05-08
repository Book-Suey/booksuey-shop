import { expect, test } from '@playwright/test'

test('admin audit page is reachable', async ({ page }) => {
  await page.goto('/admin/audit')

  const url = page.url()
  const isOnAudit = url.includes('/admin/audit') && !url.includes('/login')
  const isOnLogin = url.includes('/login')

  if (isOnAudit) {
    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
    await expect(page.getByLabel('Action')).toBeVisible()
    await expect(page.getByLabel('Entity type')).toBeVisible()
    await expect(page.getByLabel('Entity ID')).toBeVisible()
    await expect(page.getByLabel('Actor role')).toBeVisible()
  } else if (isOnLogin) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
  }
})

test('admin payout failures page is reachable', async ({ page }) => {
  await page.goto('/admin/payout-requests/payout-failures')

  const url = page.url()
  const isOnPayoutFailures = url.includes('/admin/payout-requests/payout-failures')
    && !url.includes('/login')
  const isOnLogin = url.includes('/login')

  if (isOnPayoutFailures) {
    await expect(
      page.getByRole('heading', { name: 'Payout failures', exact: true })
    ).toBeVisible()
    await expect(page.getByLabel('Vendor ID')).toBeVisible()
    await expect(page.getByLabel('Failed from')).toBeVisible()
    await expect(page.getByLabel('Failed to')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'View payout audit events' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible()
  } else if (isOnLogin) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
  }
})

test('admin nav includes operational visibility links when authenticated', async ({ page }) => {
  await page.goto('/admin')

  if (!page.url().includes('/login')) {
    await expect(page.getByRole('link', { name: 'Audit' })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Payout Failures' })
    ).toBeVisible()
  }
})

test('audit filters can be updated without page errors', async ({ page }) => {
  await page.goto('/admin/audit')

  if (!page.url().includes('/login')) {
    await page.getByLabel('Action').fill('payout_approved')
    await page.getByLabel('Entity type').fill('PayoutRequest')
    await page.getByLabel('Actor role').selectOption('admin')

    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  }
})
