/**
 * Link crawler QA — S4.
 *
 * For every published content route and every docs slug:
 *   1. Render the page.
 *   2. Collect every <a href> on the page.
 *   3. Assert that internal hrefs resolve to a known published route or docs slug.
 *   4. Assert that every external link (<a href starting with http>) has
 *      rel="noreferrer" and target="_blank".
 *
 * "Internal" = starts with "/" and is not "//" (i.e. same-origin).
 * Hash-app views (#explore, #create, …) are not content routes — they are
 * handled by the hash router on "/". Links to "/" itself are always valid.
 * "/terms" is a permanent redirect to "/usage-risks" — valid.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ContentApp } from '@/content/ContentApp'
import { DOCS_ENTRIES, CONTENT_PATHS } from '@/content/docsRegistry'
import { isPublished } from '@/content/site'

function setPath(path: string) {
  Object.defineProperty(window, 'location', {
    value: { pathname: path, hash: '', search: '', href: `http://localhost${path}` },
    writable: true,
    configurable: true,
  })
}

/**
 * All routes that a same-origin <a href="…"> may validly point to.
 * Includes published content paths, redirect aliases, the app root, and
 * the "/#…" hash-app links that open the SPA.
 */
const KNOWN_CONTENT_PATHS = new Set<string>([
  ...CONTENT_PATHS,
  '/terms',     // permanent redirect → /usage-risks
  '/',          // SPA root
])

/** Docs slugs — links to /docs/<slug> are valid when the slug is registered. */
const KNOWN_DOC_SLUGS = new Set(DOCS_ENTRIES.map(e => e.slug))

function isKnownInternal(href: string): boolean {
  if (!href.startsWith('/') || href.startsWith('//')) return false
  if (href.startsWith('/#')) return true       // hash-app link, always valid
  if (href.startsWith('/docs/')) {
    const slug = href.replace(/^\/docs\//, '').split('#')[0].split('?')[0]
    return KNOWN_DOC_SLUGS.has(slug)
  }
  // Strip anchor / query
  const path = href.split('#')[0].split('?')[0]
  if (KNOWN_CONTENT_PATHS.has(path)) return true
  // Privacy is unpublished but the route *exists* — we allow a link to it
  // (the page just 404s). However no published page should link to it.
  return false
}

/** Rendered routes to crawl: all published content paths. */
const CRAWL_ROUTES = CONTENT_PATHS.filter(p => {
  if (p === '/docs/security') return isPublished('security')
  if (p === '/docs/development') return true
  return true
})

describe('Internal link crawler', () => {
  beforeEach(() => { cleanup() })

  CRAWL_ROUTES.forEach(route => {
    it(`${route}: every internal link resolves to a known route`, () => {
      setPath(route)
      const { container } = render(<ContentApp />)

      const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
      const internalBad: string[] = []

      for (const a of anchors) {
        const href = a.getAttribute('href') ?? ''
        if (!href.startsWith('/') || href.startsWith('//')) continue
        if (!isKnownInternal(href)) {
          internalBad.push(href)
        }
      }

      expect(
        internalBad,
        `${route} has dead internal links: ${internalBad.join(', ')}`,
      ).toHaveLength(0)
    })
  })
})

describe('External links must have rel=noreferrer and target=_blank', () => {
  beforeEach(() => { cleanup() })

  CRAWL_ROUTES.forEach(route => {
    it(`${route}: all external links have rel=noreferrer target=_blank`, () => {
      setPath(route)
      const { container } = render(<ContentApp />)

      const anchors = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
      const bad: string[] = []

      for (const a of anchors) {
        const href = a.getAttribute('href') ?? ''
        if (!href.startsWith('http')) continue
        const rel   = (a.getAttribute('rel') ?? '').split(/\s+/)
        const target = a.getAttribute('target') ?? ''
        if (!rel.includes('noreferrer') || target !== '_blank') {
          bad.push(href)
        }
      }

      expect(
        bad,
        `${route} has external links missing rel=noreferrer or target=_blank: ${bad.join(', ')}`,
      ).toHaveLength(0)
    })
  })
})
