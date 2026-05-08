import { expect, test, type Locator, type Page } from '@playwright/test'

async function hasVisibleFocusIndicator(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (!element || element === document.body) {
      return false
    }

    const style = window.getComputedStyle(element)
    const hasOutline = style.outlineStyle !== 'none' && style.outlineWidth !== '0px'
    const hasBoxShadow = style.boxShadow !== 'none'

    return hasOutline || hasBoxShadow
  })
}

async function hasNoHorizontalOverflow(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const viewportWidth = window.innerWidth
    const documentWidth = document.documentElement.scrollWidth
    return documentWidth <= viewportWidth + 1
  })
}

async function tabUntilLocatorFocused(page: Page, locator: Locator, maxTabs = 12): Promise<void> {
  const isFocused = async (): Promise<boolean> => {
    return await locator.evaluate(
      element => element === document.activeElement
    )
  }

  if (await isFocused()) {
    return
  }

  for (let index = 0; index < maxTabs; index += 1) {
    await page.keyboard.press('Tab')
    if (await isFocused()) {
      return
    }
  }

  await expect(locator).toBeFocused()
}

test('vendor login supports keyboard focus navigation', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()

  await page.locator('body').click()

  const emailField = page.getByLabel('Email')
  const passwordField = page.getByLabel('Password')
  const signInButton = page.getByRole('button', { name: 'Sign in' })

  await tabUntilLocatorFocused(page, emailField)
  await expect(emailField).toBeFocused()
  expect(await hasVisibleFocusIndicator(page)).toBeTruthy()

  await tabUntilLocatorFocused(page, passwordField)
  await expect(passwordField).toBeFocused()
  expect(await hasVisibleFocusIndicator(page)).toBeTruthy()

  await tabUntilLocatorFocused(page, signInButton)
  await expect(signInButton).toBeFocused()
  expect(await hasVisibleFocusIndicator(page)).toBeTruthy()
})

test('auth pages render without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const routes = ['/login', '/register', '/forgot-password']

  for (const route of routes) {
    await page.goto(route)
    expect(await hasNoHorizontalOverflow(page)).toBeTruthy()
  }
})

test('major protected routes remain responsive on mobile and desktop', async ({ page }) => {
  const protectedRoutes = ['/vendor/payouts', '/admin/payout-requests', '/admin/audit']

  for (const route of protectedRoutes) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(route)

    expect(await hasNoHorizontalOverflow(page)).toBeTruthy()

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(route)

    expect(await hasNoHorizontalOverflow(page)).toBeTruthy()
  }
})

test('admin audit route exposes landmarks and labeled filters when authenticated', async ({ page }) => {
  await page.goto('/admin/audit')

  if (page.url().includes('/login')) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
    return
  }

  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  await expect(page.getByLabel('Action')).toBeVisible()
  await expect(page.getByLabel('Entity type')).toBeVisible()
  await expect(page.getByLabel('Entity ID')).toBeVisible()
  await expect(page.getByLabel('Actor role')).toBeVisible()
  await expect(page.getByLabel('From', { exact: true })).toBeVisible()
  await expect(page.getByLabel('To', { exact: true })).toBeVisible()
})

test('admin payout detail exposes accessible action controls when queue entries exist', async ({ page }) => {
  await page.goto('/admin/payout-requests')

  if (page.url().includes('/login')) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
    return
  }

  const emptyState = page.getByRole('heading', { name: 'No payouts in queue' })
  if ((await emptyState.count()) > 0) {
    await expect(page.getByRole('heading', { name: 'Payout queue', exact: true })).toBeVisible()
    return
  }

  const reviewLinks = page.getByRole('link', { name: /^Review$/ })
  if ((await reviewLinks.count()) === 0) {
    await expect(page.getByRole('heading', { name: 'Payout queue', exact: true })).toBeVisible()
    return
  }

  await reviewLinks.first().click()

  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to queue' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View request audit events' })).toBeVisible()

  const hasRequestedActions
    = (await page.getByRole('button', { name: 'Approve request' }).count()) > 0
      && (await page.getByRole('button', { name: 'Reject request' }).count()) > 0
  const hasApprovedAction
    = (await page.getByRole('button', { name: 'Create disbursement' }).count()) > 0
  const hasCompletedState
    = (await page.getByRole('heading', { name: 'Payout action completed' }).count()) > 0

  expect(hasRequestedActions || hasApprovedAction || hasCompletedState).toBeTruthy()
})
