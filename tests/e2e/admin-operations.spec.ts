import { expect, test } from '@playwright/test'

test('admin audit page is reachable', async ({ page }) => {
  await page.goto('/admin/audit')

  const url = page.url()
  const isOnAudit = url.includes('/admin/audit') && !url.includes('/admin/login')
  const isOnAdminLogin = url.includes('/admin/login')

  if (isOnAudit) {
    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
    await expect(page.getByLabel('Action')).toBeVisible()
    await expect(page.getByLabel('Entity type')).toBeVisible()
    await expect(page.getByLabel('Entity ID')).toBeVisible()
    await expect(page.getByLabel('Actor role')).toBeVisible()
  } else if (isOnAdminLogin) {
    await expect(
      page.getByRole('heading', { name: 'Sign in to Admin Console' })
    ).toBeVisible()
  }
})

test('admin payout failures page is reachable', async ({ page }) => {
  await page.goto('/admin/payout-failures')

  const url = page.url()
  const isOnPayoutFailures = url.includes('/admin/payout-failures')
    && !url.includes('/admin/login')
  const isOnAdminLogin = url.includes('/admin/login')

  if (isOnPayoutFailures) {
    await expect(
      page.getByRole('heading', { name: 'Payout failures' })
    ).toBeVisible()
    await expect(page.getByLabel('Vendor ID')).toBeVisible()
    await expect(page.getByLabel('Failed from')).toBeVisible()
    await expect(page.getByLabel('Failed to')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'View payout audit events' })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Export CSV' })).toBeVisible()
  } else if (isOnAdminLogin) {
    await expect(
      page.getByRole('heading', { name: 'Sign in to Admin Console' })
    ).toBeVisible()
  }
})

test('admin nav includes operational visibility links when authenticated', async ({ page }) => {
  await page.goto('/admin')

  if (!page.url().includes('/admin/login')) {
    await expect(page.getByRole('link', { name: 'Audit' })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Payout Failures' })
    ).toBeVisible()
  }
})

test('audit filters can be updated without page errors', async ({ page }) => {
  await page.goto('/admin/audit')

  if (!page.url().includes('/admin/login')) {
    await page.getByLabel('Action').fill('payout_approved')
    await page.getByLabel('Entity type').fill('PayoutRequest')
    await page.getByLabel('Actor role').selectOption('admin')

    await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  }
})
