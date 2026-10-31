/**
 * S2 docs content tests.
 * 1. Every registry slug has content in DOCS_CONTENT.
 * 2. No article contains TODO, OPEN, Pending or lorem.
 * 3. Every internal link (/docs/:slug, /security, /faq, /support, /usage-risks)
 *    resolves to a registered slug or known published route.
 */
import { describe, it, expect } from 'vitest'
import { DOCS_ENTRIES, CONTENT_PATHS } from '@/content/docsRegistry'
import { DOCS_CONTENT } from '@/content/docsContent'
import { parsePathname } from '@/router'
import { isPublished } from '@/content/site'

const FORBIDDEN = ['TODO', 'OPEN', 'lorem']

// Internal links are markdown hrefs like (/docs/slug) or (/security)
const INTERNAL_LINK_RE = /\(\/([^)]+)\)/g

// All known published routes (excluding /docs/:slug children which we check separately)
const KNOWN_ROUTES = new Set([
  '/docs', '/security', '/faq', '/support', '/usage-risks',
  ...DOCS_ENTRIES.map(e => `/docs/${e.slug}`),
])

describe('DOCS_CONTENT raw markdown sanity (catches broken ?raw)', () => {
  it('overview content is longer than 500 chars', () => {
    expect(DOCS_CONTENT['overview'].length).toBeGreaterThan(500)
  })
  it('overview starts with a markdown heading (#)', () => {
    expect(DOCS_CONTENT['overview'].trimStart()).toMatch(/^#/)
  })
  it('no value is a URL path (assetsInclude breakage)', () => {
    for (const [slug, content] of Object.entries(DOCS_CONTENT)) {
      if (content.startsWith('/') && (content.includes('?raw') || content.endsWith('.md'))) {
        throw new Error(`DOCS_CONTENT["${slug}"] looks like a URL, not markdown: "${content.slice(0, 80)}"`)
      }
    }
  })
  it('every slug value is longer than 500 chars', () => {
    for (const [slug, content] of Object.entries(DOCS_CONTENT)) {
      expect(content.length, `"${slug}" is too short`).toBeGreaterThan(500)
    }
  })
})

describe('DOCS_CONTENT completeness', () => {
  for (const entry of DOCS_ENTRIES) {
    it(`slug "${entry.slug}" has content`, () => {
      expect(DOCS_CONTENT[entry.slug]).toBeTruthy()
      expect(DOCS_CONTENT[entry.slug].length).toBeGreaterThan(50)
    })
  }
})

describe('No forbidden strings in articles', () => {
  for (const [slug, content] of Object.entries(DOCS_CONTENT)) {
    for (const word of FORBIDDEN) {
      it(`"${slug}" does not contain "${word}"`, () => {
        expect(content).not.toContain(word)
      })
    }
  }
})

describe('Internal links resolve to known routes', () => {
  for (const [slug, content] of Object.entries(DOCS_CONTENT)) {
    it(`internal links in "${slug}" are all valid`, () => {
      const matches = [...content.matchAll(INTERNAL_LINK_RE)]
      for (const m of matches) {
        const path = '/' + m[1]
        // Skip external links (http/https fragments)
        if (path.startsWith('/http') || path.startsWith('/ftp')) continue
        // Skip anchors-only (#id)
        if (path.startsWith('/#')) continue
        // Must be a known route
        expect(KNOWN_ROUTES.has(path), `"${path}" in ${slug} not found in known routes`).toBe(true)
      }
    })
  }
})

describe('CONTENT_PATHS covers all published routes', () => {
  it('all DOCS_ENTRIES slugs appear in CONTENT_PATHS', () => {
    for (const entry of DOCS_ENTRIES) {
      expect(CONTENT_PATHS).toContain(`/docs/${entry.slug}`)
    }
  })

  it('CONTENT_PATHS does not include /privacy (unpublished)', () => {
    expect(CONTENT_PATHS).not.toContain('/privacy')
    expect(isPublished('privacy')).toBe(false)
  })

  it('CONTENT_PATHS includes /usage-risks', () => {
    expect(CONTENT_PATHS).toContain('/usage-risks')
  })
})

describe('Router: all CONTENT_PATHS parse correctly', () => {
  for (const path of CONTENT_PATHS) {
    it(`${path} parses to a non-not-found route`, () => {
      const route = parsePathname(path)
      expect(route).not.toBeNull()
      expect(route?.type).not.toBe('not-found')
    })
  }
})
