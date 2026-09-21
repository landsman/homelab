import { test, expect } from '@playwright/test'
import { ROUTES } from '../../src/app/routes'
import { HOME_CATEGORIES } from '../../src/features/home/data/services'

// The hotkey strings are letter/digit combos ('Shift+R'), which is also valid
// Playwright key-press syntax — so the catalog value goes straight into press().
const SERVICE = HOME_CATEGORIES.flatMap(c => c.services).find(s => s.shortcut)!
const SERVICE_HOST = new URL(SERVICE.url).host

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.home)
  // The hotkeys register in an effect — wait for the page to be mounted first.
  await expect(page.getByRole('link', { name: `Open ${SERVICE.name}` })).toBeVisible()
})

test('switches pages', async ({ page }) => {
  await page.keyboard.press('Shift+Digit2')
  await expect(page).toHaveURL(ROUTES.status)

  await page.keyboard.press('Shift+Digit1')
  await expect(page).toHaveURL(ROUTES.home)
})

test('opens the service it is bound to', async ({ page }) => {
  // Stubbed so the suite never leaves localhost.
  await page.route(
    url => url.host === SERVICE_HOST,
    route => route.fulfill({ contentType: 'text/html', body: SERVICE.name })
  )

  await page.keyboard.press(SERVICE.shortcut!)

  await expect(page).toHaveURL(new RegExp(SERVICE_HOST.replace(/\./g, '\\.')))
})

test('stays quiet while the search box is focused', async ({ page }) => {
  const search = page.getByPlaceholder('Search services…')
  await search.focus()

  await search.press(SERVICE.shortcut!)

  await expect(page).toHaveURL(ROUTES.home)
  await expect(search).toHaveValue(/./)
})

test('the card shows the key that opens it', async ({ page }) => {
  const card = page.getByRole('link', { name: `Open ${SERVICE.name}` })

  await expect(
    card.getByText(SERVICE.shortcut!.replace('Shift+', ''), { exact: true })
  ).toBeVisible()
})
