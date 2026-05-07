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

test('forgot password page is reachable', async ({ page }) => {
  await page.goto('/forgot-password')

  await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()
})

test('reset password page renders invalid token state', async ({ page }) => {
  await page.goto('/reset-password?token=invalid-token')

  await expect(page.getByRole('heading', { name: 'Reset link is invalid' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Request a new reset link' })).toBeVisible()
})
