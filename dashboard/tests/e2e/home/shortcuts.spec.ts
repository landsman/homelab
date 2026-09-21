import { test, expect } from '../fixture'
import { ROUTES } from '@/app/routes'
import { HOME_CATEGORIES } from '@/features/home/data/services'

// The hotkey strings are letter/digit combos ('Shift+R'), which is also valid
// Playwright key-press syntax — so the catalog value goes straight into press().
const SERVICE = HOME_CATEGORIES.flatMap(c => c.services).find(s => s.shortcut)!
const SERVICE_HOST = new URL(SERVICE.url).host

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.home)
  // The hotkeys register in an effect — wait for the page to be mounted first.
  await expect(page.getByRole('link', { name: `Open ${SERVICE.name}` })).toBeVisible()
})

test('open the service they are bound to', async ({ page }) => {
  // Stubbed so the suite never leaves localhost.
  await page.route(
    url => url.host === SERVICE_HOST,
    route => route.fulfill({ contentType: 'text/html', body: SERVICE.name })
  )

  await page.keyboard.press(SERVICE.shortcut!)

  await expect(page).toHaveURL(new RegExp(SERVICE_HOST.replace(/\./g, '\\.')))
})

test('are shown on the card that they open', async ({ page }) => {
  const card = page.getByRole('link', { name: `Open ${SERVICE.name}` })

  await expect(
    card.getByText(SERVICE.shortcut!.replace('Shift+', ''), { exact: true })
  ).toBeVisible()
})
