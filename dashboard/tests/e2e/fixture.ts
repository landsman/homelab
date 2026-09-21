import { test as base, expect } from '@playwright/test'

/**
 * Same `test` as Playwright's, plus an on-screen label naming the running test.
 * Only in a watched run (`make e2e-head` sets SLOW_MO) — a headless or CI run
 * gets the plain page, so nothing can match the label by accident.
 */
export const test = base.extend<{ label: void }>({
  label: [
    async ({ page }, use, testInfo) => {
      if (process.env.SLOW_MO) {
        // addInitScript, not one injection: it has to survive every navigation.
        await page.addInitScript(
          title => {
            const draw = () => {
              const el = document.createElement('div')
              el.textContent = title
              el.setAttribute('aria-hidden', 'true')
              el.style.cssText = [
                'position:fixed',
                'left:16px',
                'bottom:16px',
                'z-index:2147483647',
                'padding:10px 16px',
                'border-radius:8px',
                'background:#000',
                'color:#fff',
                'font:600 13px/1 ui-monospace,monospace',
                'pointer-events:none',
              ].join(';')
              document.body.append(el)
            }
            if (document.body) draw()
            else window.addEventListener('DOMContentLoaded', draw)
          },
          `▶ ${testInfo.file.split('/e2e/')[1]?.replace('.spec.ts', '')} › ${testInfo.title}`
        )
      }
      await use()
    },
    { auto: true },
  ],
})

export { expect }
