// The CV's print layout (styles/print.css, components/cv.css) saved as a PDF
// into the build, for the CV page's download button. Runs after `vite build`
// (package.json's postbuild) against the built site served by Pages' rules,
// so the PDF is what printing the live page gives.
import { chromium } from '@playwright/test'
import { ROUTES } from '../src/app/routes.ts'
import { createHandler } from './preview.ts'

const dir = 'dist/client'
// Loopback only: nothing else on the network may ask it for files.
const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: await createHandler(dir) })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()
  // Nothing leaves the machine. The deploy's build carries the GTM and Web
  // Analytics tokens, so the page would otherwise count every deploy as a
  // visit and wait on Google's scripts before printing.
  await page.route(
    url => url.origin !== server.url.origin,
    route => route.abort()
  )
  // Laid out for paper from the start: a font face the screen layout does not
  // need (the Czech letters are in the projects only print spells out) is
  // otherwise asked for during the print itself, too late to be in it.
  await page.emulateMedia({ media: 'print' })
  // The fonts, the portrait and the QR codes all load before the print.
  await page.goto(new URL(ROUTES.cv, server.url).href, { waitUntil: 'networkidle' })
  // A string: this script is typed without the DOM.
  await page.evaluate('document.fonts.ready')
  // Saved where the page's button points, so the name — dated by the build
  // (vite.config.ts) — has one source.
  const path = await page.locator('a.cv-download').getAttribute('href')
  if (!path?.endsWith('.pdf')) throw new Error(`the CV's download button points at ${path}`)
  await page.pdf({
    path: `${dir}${path}`,
    // The size and margins are @page's, so the PDF and Ctrl+P agree.
    preferCSSPageSize: true,
    // Tagged, so the text reads in order to a screen reader and to the parsers
    // recruiting tools run a CV through; the outline lists the jobs.
    tagged: true,
    outline: true,
  })
  console.log(`wrote ${dir}${path}`)
} finally {
  await browser.close()
  server.stop()
}
