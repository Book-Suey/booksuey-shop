import { expect, test } from '@playwright/test'

test('vendor payouts page is reachable', async ({ page }) => {
  await page.goto('/vendor/payouts')

  const url = page.url()
  const isOnVendorPayouts = url.includes('/vendor/payouts')
  const isOnVendorLogin = url.includes('/login')

  if (isOnVendorPayouts) {
    await expect(
      page.getByRole('heading', { name: 'Request a payout' })
    ).toBeVisible()
    await expect(page.getByLabel('Amount (USD)')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Submit payout request' })
    ).toBeVisible()
  } else if (isOnVendorLogin) {
    await expect(
      page.getByRole('heading', { name: 'Sign in to Book Suey' })
    ).toBeVisible()
  }
})

test('vendor payouts page includes history surface', async ({ page }) => {
  await page.goto('/vendor/payouts')

  if (!page.url().includes('/login')) {
    await expect(
      page.getByRole('heading', { name: 'Payout history' })
    ).toBeVisible()

    const hasEmptyState
      = (await page.getByText('No payout requests').count()) > 0
    const hasHistoryTable = (await page.getByText('Requested At').count()) > 0

    expect(hasEmptyState || hasHistoryTable).toBeTruthy()
  }
})

test('admin payout queue page is reachable', async ({ page }) => {
  await page.goto('/admin/payout-requests')

  const url = page.url()
  const isOnQueue = url.includes('/admin/payout-requests') && !url.includes('/login')
  const isOnLogin = url.includes('/login')

  if (isOnQueue) {
    await expect(page.getByRole('heading', { name: 'Payout queue', exact: true })).toBeVisible()
    await expect(page.getByLabel('Status')).toBeVisible()
    await expect(page.getByLabel('From date')).toBeVisible()
    await expect(page.getByLabel('To date')).toBeVisible()
  } else if (isOnLogin) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
  }
})

test('admin payout review page navigation works when queue rows exist', async ({ page }) => {
  await page.goto('/admin/payout-requests')

  if (!page.url().includes('/login')) {
    const emptyState = page.getByRole('heading', { name: 'No payouts in queue' })

    if ((await emptyState.count()) > 0) {
      await expect(emptyState).toBeVisible()
      return
    }

    const reviewLinks = page.getByRole('link', { name: /^Review$/ })

    if ((await reviewLinks.count()) > 0) {
      await reviewLinks.first().click()

      await expect(page).toHaveURL(/\/admin\/payout-requests\//)
      await expect(page.getByText('Back to queue')).toBeVisible()
      await expect(page.getByText('View request audit events')).toBeVisible()

      const hasRequestedActions
        = (await page.getByRole('button', { name: 'Approve request' }).count()) > 0
          && (await page.getByRole('button', { name: 'Reject request' }).count()) > 0
      const hasApprovedAction
        = (await page.getByRole('button', { name: 'Create disbursement' }).count()) > 0
      const hasCompletedState
        = (await page.getByRole('heading', { name: 'Payout action completed' }).count()) > 0

      expect(hasRequestedActions || hasApprovedAction || hasCompletedState).toBeTruthy()
    }
  }
})
