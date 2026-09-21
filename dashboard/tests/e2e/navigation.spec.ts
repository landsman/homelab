import { test, expect } from '@playwright/test'
import { ROUTES } from '../../src/app/routes'

test('navigates between home and status', async ({ page }) => {
  await page.goto(ROUTES.home)

  await page.getByRole('link', { name: 'Status' }).first().click()
  await expect(page).toHaveURL(ROUTES.status)
  await expect(page.getByRole('button', { name: /External Services/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Homelab/ })).toBeVisible()

  await page.getByRole('link', { name: 'Home' }).first().click()
  await expect(page).toHaveURL(ROUTES.home)
  await expect(page.getByRole('link', { name: 'Open Hacker News' })).toBeVisible()
})

test('a query typed on one page does not follow to the other', async ({ page }) => {
  await page.goto(ROUTES.home)
  const search = page.getByPlaceholder('Search services…')
  await search.fill('reddit')

  await page.getByRole('link', { name: 'Status' }).first().click()

  await expect(page).toHaveURL(ROUTES.status)
  await expect(search).toHaveValue('')
})
