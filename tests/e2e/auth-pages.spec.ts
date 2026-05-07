import { test, expect } from '@playwright/test'

test('login page is reachable', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Sign in to Book Suey' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create your vendor account' })).toBeVisible()
})

test('register page is reachable', async ({ page }) => {
  await page.goto('/register')

  await expect(page.getByRole('heading', { name: 'Register your vendor account' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
})
