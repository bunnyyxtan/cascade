/**
 * rootNav.test.tsx — tests the Root routing logic:
 * parsePathname on '/' returns null → app view.
 * parsePathname on '/docs' returns non-null → content view.
 * Simulates what the Root component does without mounting heavy providers.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { parsePathname } from '@/router'

function setPath(p: string) {
  Object.defineProperty(window, 'location', {
    value: { pathname: p, hash: '', search: '', href: `http://localhost${p}` },
    writable: true,
    configurable: true,
  })
}

describe('Root routing logic (parsePathname)', () => {
  beforeEach(() => setPath('/'))

  it('/ shows app (parsePathname returns null)', () => {
    setPath('/')
    expect(parsePathname(window.location.pathname)).toBeNull()
  })

  it('/docs shows content (parsePathname non-null)', () => {
    setPath('/docs')
    expect(parsePathname(window.location.pathname)).not.toBeNull()
  })

  it('/docs/overview shows content', () => {
    setPath('/docs/overview')
    expect(parsePathname(window.location.pathname)).not.toBeNull()
  })

  it('/security shows content', () => {
    setPath('/security')
    expect(parsePathname(window.location.pathname)).not.toBeNull()
  })

  it('/faq shows content', () => {
    setPath('/faq')
    expect(parsePathname(window.location.pathname)).not.toBeNull()
  })

  it('/support shows content', () => {
    setPath('/support')
    expect(parsePathname(window.location.pathname)).not.toBeNull()
  })

  it('/usage-risks shows content', () => {
    setPath('/usage-risks')
    expect(parsePathname(window.location.pathname)).not.toBeNull()
  })

  it('/#explore hash routes stay on app (pathname is /)', () => {
    setPath('/')
    // hash lives in window.location.hash, pathname stays '/'
    expect(parsePathname('/')).toBeNull()
  })
})
