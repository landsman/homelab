import { test, expect } from '@playwright/test'
import { ROUTES } from '../../../src/app/routes'

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.home)
})

test('filters the grid down to matching services', async ({ page }) => {
  await page.getByPlaceholder('Search services…').fill('reddit')

  await expect(page.getByRole('link', { name: 'Open Reddit' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Hacker News' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'LLM' })).toBeHidden()
})

test('says so when nothing matches', async ({ page }) => {
  await page.getByPlaceholder('Search services…').fill('no such service')

  await expect(page.getByText('No matching services')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Open / })).toHaveCount(0)
})
