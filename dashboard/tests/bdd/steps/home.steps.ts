import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
// A relative path with its extension: Node resolves this itself, and the `@`
// alias only exists for the bundler and for Playwright.
import { ROUTES } from '../../../src/app/routes.ts'
import { AppWorld, BASE_URL } from '../support/world.ts'

Given('I am on the home page', async function (this: AppWorld) {
  await this.page.goto(`${BASE_URL}${ROUTES.home}`)
  await expect(this.page.getByRole('link', { name: 'Open Hacker News' })).toBeVisible()
})

When('I search for {string}', async function (this: AppWorld, query: string) {
  await this.page.getByPlaceholder('Search services…').fill(query)
})

When('I press {string}', async function (this: AppWorld, key: string) {
  await this.page.keyboard.press(key)
})

Then('I see the {string} shortcut', async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole('link', { name: `Open ${name}` })).toBeVisible()
})

Then('I do not see the {string} shortcut', async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole('link', { name: `Open ${name}` })).toBeHidden()
})

Then('I am told that nothing matches', async function (this: AppWorld) {
  await expect(this.page.getByText('No matching services')).toBeVisible()
})

Then('I am on the status page', async function (this: AppWorld) {
  await expect(this.page).toHaveURL(`${BASE_URL}${ROUTES.status}`)
})
