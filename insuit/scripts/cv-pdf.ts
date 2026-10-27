// The CV's print layout (styles/print.css, components/cv.css) saved as a PDF
// into the build, for the CV page's download button. Runs after `vite build`
// (package.json's postbuild) against the built site served by Pages' rules,
// so the PDF is what printing the live page gives.
import { chromium } from '@playwright/test'
import { CV_PDF } from '../src/app/assets.ts'
import { ROUTES } from '../src/app/routes.ts'
import { createHandler } from './preview.ts'

const dir = 'dist/client'
const server = Bun.serve({ port: 0, fetch: await createHandler(dir) })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  // The fonts, the portrait and the QR codes all load before the print.
  await page.goto(new URL(ROUTES.cv, server.url).href, { waitUntil: 'networkidle' })
  await page.pdf({
    path: `${dir}${CV_PDF}`,
    // The size and margins are @page's, so the PDF and Ctrl+P agree.
    preferCSSPageSize: true,
    // Tagged, so the text reads in order to a screen reader and to the parsers
    // recruiting tools run a CV through; the outline lists the jobs.
    tagged: true,
    outline: true,
  })
  console.log(`wrote ${dir}${CV_PDF}`)
} finally {
  await browser.close()
  server.stop()
}
