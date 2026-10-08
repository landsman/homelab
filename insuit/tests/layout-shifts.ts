// Layout shifts while a page loads, as the browser itself reports them (the
// numbers behind Core Web Vitals' CLS), shared by Playwright and Cucumber.
import type { Page } from "@playwright/test";

/** The part of the Layout Instability API's entry used here; not in lib.dom. */
type LayoutShift = PerformanceEntry & { sources?: { node?: Node | null }[] };

declare global {
  interface Window {
    shifted?: Element[];
  }
}

/** Start recording before the page loads: call it ahead of `goto`. The page's
    script is held back a moment as well, as on a phone's connection, so the
    prerendered page is painted before the app takes it over — the moment a
    shift would happen. */
export async function recordLayoutShifts(page: Page) {
  await page.route(/\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fallback();
  });
  await page.addInitScript(() => {
    window.shifted = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as LayoutShift[])
        for (const { node } of entry.sources ?? [])
          if (node instanceof Element) window.shifted!.push(node);
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** What moved inside `selector` since the page started loading, as tag names. */
export function shiftedWithin(page: Page, selector: string): Promise<string[]> {
  return page.evaluate(
    (selector) =>
      (window.shifted ?? []).filter((el) => el.closest(selector)).map((el) => el.tagName),
    selector,
  );
}
