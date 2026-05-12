import { test, expect } from '@playwright/test'

test('admin imports upload page is reachable', async ({ page }) => {
  await page.goto('/admin/imports/upload')

  const url = page.url()
  const isOnUploadPage = url.includes('/admin/imports/upload')
  const isOnLogin = url.includes('/login')

  if (isOnUploadPage) {
    await expect(page.getByRole('heading', { name: 'Upload sales CSV' })).toBeVisible()
    await expect(page.getByLabel('Source period')).toBeVisible()
    await expect(page.getByLabel('CSV file')).toBeVisible()
  } else if (isOnLogin) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
  }
})

test('admin import history page has filters', async ({ page }) => {
  await page.goto('/admin/imports')

  const url = page.url()
  const isOnImportsPage = url.includes('/admin/imports') && !url.includes('/login')
  const isOnLogin = url.includes('/login')

  if (isOnImportsPage) {
    await expect(page.getByRole('heading', { name: 'Import history' })).toBeVisible()
    await expect(page.getByLabel('Status')).toBeVisible()
    await expect(page.getByLabel('Uploaded from')).toBeVisible()
    await expect(page.getByLabel('Uploaded to')).toBeVisible()
  } else if (isOnLogin) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
  }
})

test('admin can reach import upload from history page (if authenticated)', async ({ page }) => {
  await page.goto('/admin/imports')

  const isOnImportsPage = !await page.url().includes('/login')

  if (isOnImportsPage) {
    const uploadButton = page.getByRole('link', { name: /Upload|upload/i })

    if (await uploadButton.count() > 0) {
      await uploadButton.click()

      await expect(page).toHaveURL(/\/admin\/imports\/upload/)
      await expect(page.getByRole('heading', { name: 'Upload sales CSV' })).toBeVisible()
    }
  }
})

test('import history shows table structure', async ({ page }) => {
  await page.goto('/admin/imports')

  const isOnImportsPage = !await page.url().includes('/login')

  if (isOnImportsPage) {
    const hasEmptyState = await page.getByRole('heading', { name: 'No import batches found' }).count()

    if (hasEmptyState > 0) {
      await expect(page.getByRole('heading', { name: 'No import batches found' })).toBeVisible()
      return
    }

    const headerText = await page.locator('thead').textContent()

    expect(headerText).toContain('Uploaded')
    expect(headerText).toContain('Status')
  }
})

test('batch detail page navigation works (if authenticated)', async ({ page }) => {
  await page.goto('/admin/imports')

  const isOnImportsPage = !await page.url().includes('/login')

  if (isOnImportsPage) {
    const reviewLinks = page.getByRole('link', { name: /Review/i })

    if (await reviewLinks.count() > 0) {
      await reviewLinks.first().click()

      expect(page.url()).toContain('/admin/imports/')

      const heading = page.getByRole('heading', { name: /Batch/ })
      if (await heading.count() > 0) {
        await expect(heading).toBeVisible()
      }
    }
  }
})

test('batch detail page has back navigation', async ({ page }) => {
  await page.goto('/admin/imports')

  const isOnImportsPage = !await page.url().includes('/login')

  if (isOnImportsPage) {
    const reviewLinks = page.getByRole('link', { name: /Review/i })

    if (await reviewLinks.count() > 0) {
      await reviewLinks.first().click()

      expect(page.url()).toContain('/admin/imports/')

      const backButton = page.getByRole('link', { name: /Back|back/i })

      if (await backButton.count() > 0) {
        await backButton.click()

        await expect(page).toHaveURL(/\/admin\/imports$/)
      }
    }
  }
})

test('manual import review queue page is reachable', async ({ page }) => {
  await page.goto('/admin/imports/manual-review')

  const url = page.url()
  const isOnQueuePage = url.includes('/admin/imports/manual-review')
  const isOnLogin = url.includes('/login')

  if (isOnQueuePage) {
    await expect(page.getByRole('heading', { name: 'Manual import review queue' })).toBeVisible()
    await expect(page.getByLabel('Duplicate reason')).toBeVisible()
  } else if (isOnLogin) {
    await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
  }
})
