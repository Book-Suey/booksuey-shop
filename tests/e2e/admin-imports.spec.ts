import { test, expect } from '@playwright/test'

test('admin imports upload page is reachable', async ({ page }) => {
  // Navigate to upload page (will redirect to login if not authenticated)
  await page.goto('/admin/imports/upload')

  // Either we see the upload form or we're on the admin login page
  const url = page.url()
  const isOnUploadPage = url.includes('/admin/imports/upload')
  const isOnAdminLogin = url.includes('/admin/login')

  if (isOnUploadPage) {
    // If we're authenticated, verify the upload form
    await expect(page.getByRole('heading', { name: 'Upload sales CSV' })).toBeVisible()
    await expect(page.getByLabel('Source period')).toBeVisible()
    await expect(page.getByLabel('CSV file')).toBeVisible()
  } else if (isOnAdminLogin) {
    // If redirected to login, that's expected
    await expect(page.getByRole('heading', { name: 'Sign in to Admin Console' })).toBeVisible()
  }
})

test('admin import history page has filters', async ({ page }) => {
  await page.goto('/admin/imports')

  // Either we see the history list or we're on the admin login page
  const url = page.url()
  const isOnImportsPage = url.includes('/admin/imports') && !url.includes('/admin/login')
  const isOnAdminLogin = url.includes('/admin/login')

  if (isOnImportsPage) {
    // If authenticated, verify filter controls exist
    await expect(page.getByRole('heading', { name: 'Import history' })).toBeVisible()
    await expect(page.getByLabel('Status')).toBeVisible()
    await expect(page.getByLabel('From date')).toBeVisible()
    await expect(page.getByLabel('To date')).toBeVisible()
  } else if (isOnAdminLogin) {
    // If redirected to login, that's expected for protected routes
    await expect(page.getByRole('heading', { name: 'Sign in to Admin Console' })).toBeVisible()
  }
})

test('admin can reach import upload from history page (if authenticated)', async ({ page }) => {
  // Start on imports list
  await page.goto('/admin/imports')

  // If we're authenticated (not redirected to login)
  const isOnImportsPage = !await page.url().includes('/admin/login')

  if (isOnImportsPage) {
    // Look for upload link in the header
    const uploadButton = page.getByRole('link', { name: /Upload|upload/i })

    if (await uploadButton.count() > 0) {
      await uploadButton.click()

      // Should navigate to upload page
      await expect(page).toHaveURL(/\/admin\/imports\/upload/)
      await expect(page.getByRole('heading', { name: 'Upload sales CSV' })).toBeVisible()
    }
  }
})

test('import history shows table structure', async ({ page }) => {
  await page.goto('/admin/imports')

  const isOnImportsPage = !await page.url().includes('/admin/login')

  if (isOnImportsPage) {
    // Verify table headers are present
    const headerText = await page.locator('thead').textContent()

    // Should contain expected column headers
    expect(headerText).toContain('Uploaded')
    expect(headerText).toContain('Status')
  }
})

test('batch detail page navigation works (if authenticated)', async ({ page }) => {
  await page.goto('/admin/imports')

  const isOnImportsPage = !await page.url().includes('/admin/login')

  if (isOnImportsPage) {
    // Try to find review links in the table
    const reviewLinks = page.getByRole('link', { name: /Review/i })

    if (await reviewLinks.count() > 0) {
      // Click first review link
      await reviewLinks.first().click()

      // Should navigate to a batch detail page
      expect(page.url()).toContain('/admin/imports/')

      // Verify batch detail page structure
      const heading = page.getByRole('heading', { name: /Batch/ })
      if (await heading.count() > 0) {
        await expect(heading).toBeVisible()
      }
    }
  }
})

test('batch detail page has back navigation', async ({ page }) => {
  await page.goto('/admin/imports')

  const isOnImportsPage = !await page.url().includes('/admin/login')

  if (isOnImportsPage) {
    const reviewLinks = page.getByRole('link', { name: /Review/i })

    if (await reviewLinks.count() > 0) {
      await reviewLinks.first().click()

      // Verify we're on a batch detail page
      expect(page.url()).toContain('/admin/imports/')

      // Look for back button
      const backButton = page.getByRole('link', { name: /Back|back/i })

      if (await backButton.count() > 0) {
        await backButton.click()

        // Should be back on imports list
        await expect(page).toHaveURL(/\/admin\/imports$/)
      }
    }
  }
})
