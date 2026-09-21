import { test, expect } from '@playwright/test'
import { ROUTES } from '../../../src/app/routes'

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.home)
})

test('Space focuses the search box', async ({ page }) => {
  const search = page.getByPlaceholder('Search services…')
  await expect(search).not.toBeFocused()

  await page.keyboard.press('Space')

  await expect(search).toBeFocused()
})

test('a query typed on one page does not follow to the other', async ({ page }) => {
  const search = page.getByPlaceholder('Search services…')
  await search.fill('reddit')

  await page.getByRole('link', { name: 'Status' }).first().click()

  await expect(page).toHaveURL(ROUTES.status)
  await expect(search).toHaveValue('')
})

test('shortcuts stay quiet while the search box is focused', async ({ page }) => {
  const search = page.getByPlaceholder('Search services…')
  await search.focus()

  await search.press('Shift+R')

  await expect(page).toHaveURL(ROUTES.home)
  await expect(search).toHaveValue(/./)
})
