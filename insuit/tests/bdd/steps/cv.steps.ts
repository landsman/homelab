import { readFile } from 'node:fs/promises'
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'
import { ROUTES } from '@/app/routes'
import { AppWorld } from '../support/world.ts'

Given('I am on the CV', async function (this: AppWorld) {
  await this.page.goto(ROUTES.cv)
  await expect(this.page.getByRole('heading', { name: 'Experience' })).toBeVisible()
})

When('I download the CV', async function (this: AppWorld) {
  ;[this.download] = await Promise.all([
    this.page.waitForEvent('download'),
    this.page.getByRole('link', { name: 'Download PDF' }).click(),
  ])
})

Then('I have the CV as a PDF dated by its last change', async function (this: AppWorld) {
  expect(this.download?.suggestedFilename()).toMatch(/^Michal-Landsman-CV-\d{4}-\d{2}-\d{2}\.pdf$/)
  const file = await readFile(await this.download!.path())
  expect(file.subarray(0, 5).toString()).toBe('%PDF-')
})

When('I open the project {string}', async function (this: AppWorld, name: string) {
  await this.page.getByRole('button', { name }).click()
  // Open for certain, so a later "no project is open" means it was closed.
  await expect(this.page.getByRole('dialog', { name })).toBeVisible()
})

Then('I read {string}', async function (this: AppWorld, text: string) {
  await expect(this.page.getByRole('dialog').getByText(text)).toBeVisible()
})

Then('no project is open', async function (this: AppWorld) {
  await expect(this.page.getByRole('dialog')).toBeHidden()
})

When('I open the photo of {string}', async function (this: AppWorld, what: string) {
  await this.page
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(what) })
    .click()
})

Then('the photo reads {string}', async function (this: AppWorld, caption: string) {
  await expect(this.page.getByRole('dialog', { name: 'Photo' }).getByText(caption)).toBeVisible()
})

// Escape closes the photo only; the project behind it stays open.
Then('the project {string} is still open', async function (this: AppWorld, name: string) {
  await expect(this.page.getByRole('dialog', { name: 'Photo' })).toBeHidden()
  await expect(this.page.getByRole('dialog', { name })).toBeVisible()
})
