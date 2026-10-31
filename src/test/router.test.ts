/**
 * Router tests — verifies pathname parsing and hash route isolation.
 */
import { describe, it, expect } from 'vitest'
import { parsePathname } from '@/router'

describe('parsePathname — content routes', () => {
  it('returns null for root /', () => {
    expect(parsePathname('/')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parsePathname('')).toBeNull()
  })

  it('returns docs-index for /docs', () => {
    expect(parsePathname('/docs')).toEqual({ type: 'docs-index' })
  })

  it('returns docs-index for /docs/ (trailing slash)', () => {
    expect(parsePathname('/docs/')).toEqual({ type: 'docs-index' })
  })

  it('returns docs-slug for /docs/overview', () => {
    expect(parsePathname('/docs/overview')).toEqual({ type: 'docs-slug', slug: 'overview' })
  })

  it('returns docs-slug for /docs/quick-start', () => {
    expect(parsePathname('/docs/quick-start')).toEqual({ type: 'docs-slug', slug: 'quick-start' })
  })

  it('returns docs-slug for /docs/contracts', () => {
    expect(parsePathname('/docs/contracts')).toEqual({ type: 'docs-slug', slug: 'contracts' })
  })

  it('returns security for /security', () => {
    expect(parsePathname('/security')).toEqual({ type: 'security' })
  })

  it('/terms redirects → returns usage-risks', () => {
    expect(parsePathname('/terms')).toEqual({ type: 'usage-risks' })
  })

  it('returns usage-risks for /usage-risks', () => {
    expect(parsePathname('/usage-risks')).toEqual({ type: 'usage-risks' })
  })

  it('returns privacy for /privacy', () => {
    expect(parsePathname('/privacy')).toEqual({ type: 'privacy' })
  })

  it('returns faq for /faq', () => {
    expect(parsePathname('/faq')).toEqual({ type: 'faq' })
  })

  it('returns support for /support', () => {
    expect(parsePathname('/support')).toEqual({ type: 'support' })
  })

  it('returns not-found for unknown paths', () => {
    const r = parsePathname('/does-not-exist')
    expect(r).toEqual({ type: 'not-found', path: '/does-not-exist' })
  })

  it('returns not-found for /docs with invalid slug chars', () => {
    const r = parsePathname('/docs/INVALID')
    expect(r).toEqual({ type: 'not-found', path: '/docs/INVALID' })
  })
})

describe('parsePathname — hash app routes stay on root', () => {
  // Hash routes are on pathname '/' — the hash is irrelevant to parsePathname
  it('root with hash returns null', () => {
    expect(parsePathname('/')).toBeNull()
  })

  // A hash like #explore would be at pathname '/' in the real browser
  // These paths must NOT be intercepted
  const appPaths = ['/', '/'] // both are root — hash lives in window.location.hash
  appPaths.forEach(p => {
    it(`${p} returns null (left to hash router)`, () => {
      expect(parsePathname(p)).toBeNull()
    })
  })
})
