import { test, expect } from '../fixture'
import { ROUTES } from '@/app/routes'
import type {} from '@/app/analytics.gen'

// What the contact page tells GTM: analytics.yaml turns these pushes into GA4
// events, so a click that stops pushing loses its count without a word.

test('a click on the address or a profile is pushed for GA4', async ({ page }) => {
  // A profile opens in a new tab, which the fixture's route does not cover.
  await page.context().route(
    url => url.hostname !== 'localhost',
    route => route.abort()
  )
  await page.goto(ROUTES.contact)

  await page.getByRole('link', { name: /@/ }).click()
  const profile = page.waitForEvent('popup')
  await page.getByRole('link', { name: /LinkedIn/ }).click()
  await (await profile).close()

  const pushed = await page.evaluate(() =>
    (window.dataLayer as { event?: string }[]).filter(entry => entry.event !== 'page_view')
  )
  expect(pushed).toEqual([
    { event: 'generate_lead' },
    { event: 'social_click', network: 'linkedin' },
  ])
})
