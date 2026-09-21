import { test, expect } from '../fixture'
import { ROUTES } from '@/app/routes'

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.home)
})

test('links switch between home and status', async ({ page }) => {
  await page.getByRole('link', { name: 'Status' }).first().click()
  await expect(page).toHaveURL(ROUTES.status)
  await expect(page.getByRole('button', { name: /External Services/ })).toBeVisible()

  await page.getByRole('link', { name: 'Home' }).first().click()
  await expect(page).toHaveURL(ROUTES.home)
  await expect(page.getByRole('link', { name: 'Open Hacker News' })).toBeVisible()
})

test('shortcuts switch between home and status', async ({ page }) => {
  // The hotkeys register in an effect — wait for the page to be mounted first.
  await expect(page.getByRole('link', { name: 'Open Hacker News' })).toBeVisible()

  await page.keyboard.press('Shift+Digit2')
  await expect(page).toHaveURL(ROUTES.status)

  await page.keyboard.press('Shift+Digit1')
  await expect(page).toHaveURL(ROUTES.home)
})
