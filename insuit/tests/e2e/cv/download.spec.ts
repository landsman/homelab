import { readFile } from 'node:fs/promises'
import { test, expect } from '../fixture'
import { CV_PDF } from '@/app/assets'
import { ROUTES } from '@/app/routes'

test.beforeEach(async ({ page }) => {
  await page.goto(ROUTES.cv)
})

test('the download button saves the CV as a named PDF', async ({ page }) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PDF' }).click(),
  ])
  expect(`/${download.suggestedFilename()}`).toBe(CV_PDF)
  // A PDF, not the 404 page under a .pdf name.
  const file = await readFile(await download.path())
  expect(file.subarray(0, 5).toString()).toBe('%PDF-')
})

test('the download button stays in view while scrolling, and out of print', async ({ page }) => {
  const button = page.getByRole('link', { name: 'Download PDF' })
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight / 2))
  await expect(button).toBeInViewport()

  await page.emulateMedia({ media: 'print' })
  await expect(button).toBeHidden()
})
