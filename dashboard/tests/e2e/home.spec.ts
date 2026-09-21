import { test, expect } from '@playwright/test'
import { ROUTES } from '../../src/app/routes'

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.home)
})

test('renders the service grid', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Hacker News' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Free time' })).toBeVisible()
})

test('search filters the grid down to matching services', async ({ page }) => {
  await page.getByPlaceholder('Search services…').fill('reddit')

  await expect(page.getByRole('link', { name: 'Open Reddit' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Hacker News' })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'LLM' })).toBeHidden()
})

test('search says so when nothing matches', async ({ page }) => {
  await page.getByPlaceholder('Search services…').fill('no such service')

  await expect(page.getByText('No matching services')).toBeVisible()
  await expect(page.getByRole('link', { name: /^Open / })).toHaveCount(0)
})

test('Space focuses the search box', async ({ page }) => {
  const search = page.getByPlaceholder('Search services…')
  await expect(search).not.toBeFocused()

  await page.keyboard.press('Space')

  await expect(search).toBeFocused()
})
