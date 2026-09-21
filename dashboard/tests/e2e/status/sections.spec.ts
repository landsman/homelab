import { test, expect } from '../fixture'
import { ROUTES } from '@/app/routes'

test.beforeEach(async ({ page }) => {
  // The cards poll real status APIs — blocked so the suite never leaves
  // localhost. Nothing here asserts the fetched data, only the page around it.
  await page.route(
    url => url.hostname !== 'localhost',
    route => route.abort()
  )
  await page.goto(ROUTES.status)
})

test('renders both sections', async ({ page }) => {
  await expect(page.getByRole('button', { name: /External Services/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Homelab/ })).toBeVisible()
  await expect(page.getByTitle('Open GitHub status page')).toBeVisible()
})

test('search filters the cards and the section count', async ({ page }) => {
  await page.getByPlaceholder('Search services…').fill('github')

  await expect(page.getByTitle('Open GitHub status page')).toBeVisible()
  await expect(page.getByTitle('Open Codeberg status page')).toBeHidden()
  await expect(page.getByRole('button', { name: 'External Services (1)' })).toBeVisible()
  await expect(page.getByText('No matching services')).toBeVisible()
})

test('a section collapses and stays collapsed on reload', async ({ page }) => {
  await page.getByRole('button', { name: /External Services/ }).click()
  await expect(page.getByTitle('Open GitHub status page')).toBeHidden()

  await page.reload()

  await expect(page.getByTitle('Open GitHub status page')).toBeHidden()
})
