import { afterEach, expect, test, vi } from 'vitest'
import {
  gtmNoscript,
  gtmScript,
  trackContactEmail,
  trackPageView,
  trackSocialClick,
} from '@/app/gtm'

afterEach(() => vi.unstubAllGlobals())

test('the snippet and its fallback name the container', () => {
  expect(gtmScript('GTM-X')).toContain("'GTM-X'")
  expect(gtmNoscript('GTM-X')).toContain('ns.html?id=GTM-X')
})

test('a page swapped in place pushes a page view for the new page', () => {
  const dataLayer: Record<string, unknown>[] = []
  vi.stubGlobal('window', {
    dataLayer,
    location: { href: 'https://www.insuit.cz/cv' },
  })
  vi.stubGlobal('document', { title: 'Curriculum Vitae - Michal Landsman' })

  trackPageView('/cv')

  expect(dataLayer).toEqual([
    {
      event: 'page_view',
      page_path: '/cv',
      page_location: 'https://www.insuit.cz/cv',
      page_title: 'Curriculum Vitae - Michal Landsman',
    },
  ])
})

test('a click on the contact address pushes the event GA4 counts as a key event', () => {
  const dataLayer: Record<string, unknown>[] = []
  vi.stubGlobal('window', { dataLayer })

  trackContactEmail()

  expect(dataLayer).toEqual([{ event: 'contact_email' }])
})

test('a click on a profile pushes which network it leads to', () => {
  const dataLayer: Record<string, unknown>[] = []
  vi.stubGlobal('window', { dataLayer })

  trackSocialClick('linkedin')

  expect(dataLayer).toEqual([{ event: 'social_click', network: 'linkedin' }])
})

// No container means no dataLayer: a local build still runs the app.
test('without a container there is nothing to push to', () => {
  vi.stubGlobal('window', {})
  vi.stubGlobal('document', { title: '' })
  expect(() => trackPageView('/')).not.toThrow()
  expect(() => trackContactEmail()).not.toThrow()
  expect(() => trackSocialClick('github')).not.toThrow()
})
