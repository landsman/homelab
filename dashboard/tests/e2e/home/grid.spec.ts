import { test, expect } from '@playwright/test'
import { ROUTES } from '../../../src/app/routes'

test('renders the service grid', async ({ page }) => {
  await page.goto(ROUTES.home)

  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Hacker News' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Free time' })).toBeVisible()
})
