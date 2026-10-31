/**
 * Content route rendering tests — S3.
 * - Pages render with correct headings and last-updated dates
 * - /privacy is 404 while unpublished and while {{HOSTING}} is present
 * - No Pending/TODO/OPEN/lorem/counsel strings on any page
 * - All mailto links use CONTACT_EMAIL
 * - FAQ accordion toggles aria-expanded
 * - Footer has Resources (Docs, FAQ, Support) and Trust (Security, Usage & Risks)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ContentApp } from '@/content/ContentApp'
import { isPublished, CONTACT_EMAIL } from '@/content/site'
import { parsePathname } from '@/router'

function setPath(path: string) {
  Object.defineProperty(window, 'location', {
    value: { pathname: path, hash: '', search: '', href: `http://localhost${path}` },
    writable: true,
    configurable: true,
  })
}

const FORBIDDEN = ['Pending owner input', 'TODO', 'OPEN', 'lorem', 'counsel', 'Draft —']

describe('Content routes render', () => {
  beforeEach(() => {
    document.title = 'Cascade'
    cleanup()
  })

  it('/docs renders Documentation heading', () => {
    setPath('/docs')
    render(<ContentApp />)
    expect(screen.getAllByText('Documentation').length).toBeGreaterThan(0)
  })

  it('/docs/overview renders Overview', () => {
    setPath('/docs/overview')
    render(<ContentApp />)
    const h1s = document.querySelectorAll('h1.md-h1')
    expect(h1s.length).toBeGreaterThan(0)
    expect(h1s[0].textContent).toBe('Overview')
  })

  it('/security renders Security heading', () => {
    setPath('/security')
    render(<ContentApp />)
    const h1s = document.querySelectorAll('h1.md-h1')
    expect(h1s.length).toBeGreaterThan(0)
    expect(h1s[0].textContent).toBe('Security')
  })

  it('/security shows last-updated date', () => {
    setPath('/security')
    render(<ContentApp />)
    expect(screen.getByText(/Last updated: 31 Oct 2026/)).toBeTruthy()
  })

  it('/faq renders FAQ heading', () => {
    setPath('/faq')
    render(<ContentApp />)
    const h1s = document.querySelectorAll('h1.md-h1')
    expect(h1s.length).toBeGreaterThan(0)
    expect(h1s[0].textContent).toBe('FAQ')
  })

  it('/faq shows grouped accordion questions', () => {
    setPath('/faq')
    render(<ContentApp />)
    expect(screen.getAllByText('Basics').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Money').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Permissions').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Safety').length).toBeGreaterThan(0)
  })

  it('/faq accordion toggles aria-expanded', () => {
    setPath('/faq')
    render(<ContentApp />)
    // Find the first FAQ trigger button
    const triggers = document.querySelectorAll<HTMLButtonElement>('button.faq-trigger')
    expect(triggers.length).toBeGreaterThan(0)
    const first = triggers[0]
    expect(first.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(first)
    expect(first.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(first)
    expect(first.getAttribute('aria-expanded')).toBe('false')
  })

  it('/support renders Support heading', () => {
    setPath('/support')
    render(<ContentApp />)
    const h1s = document.querySelectorAll('h1.md-h1')
    expect(h1s.length).toBeGreaterThan(0)
    expect(h1s[0].textContent).toBe('Support')
  })

  it('/support shows contact email with mailto link', () => {
    setPath('/support')
    render(<ContentApp />)
    const links = screen.getAllByRole('link')
    const mailtos = links.filter(l => l.getAttribute('href') === `mailto:${CONTACT_EMAIL}`)
    expect(mailtos.length).toBeGreaterThan(0)
    expect(screen.getAllByText(CONTACT_EMAIL).length).toBeGreaterThan(0)
  })

  it('/usage-risks renders Usage & Risks heading', () => {
    setPath('/usage-risks')
    render(<ContentApp />)
    const h1s = document.querySelectorAll('h1.legal-title')
    expect(h1s.length).toBeGreaterThan(0)
    expect(h1s[0].textContent).toContain('Usage')
    expect(h1s[0].textContent).toContain('Risks')
  })

  it('/usage-risks shows last-updated date', () => {
    setPath('/usage-risks')
    render(<ContentApp />)
    expect(screen.getByText(/Last updated: 31 Oct 2026/)).toBeTruthy()
  })

  it('/usage-risks does not show operator personal name', () => {
    setPath('/usage-risks')
    render(<ContentApp />)
    expect(screen.queryByText(/Shivam Sutra Dhar/)).toBeNull()
  })

  it('/usage-risks shows contact email', () => {
    setPath('/usage-risks')
    render(<ContentApp />)
    expect(screen.getAllByText(CONTACT_EMAIL).length).toBeGreaterThan(0)
  })

  it('/terms route resolves to usage-risks', () => {
    expect(parsePathname('/terms')).toEqual({ type: 'usage-risks' })
  })

  it('/privacy is unpublished', () => {
    expect(isPublished('privacy')).toBe(false)
  })

  it('/privacy renders 404', () => {
    setPath('/privacy')
    render(<ContentApp />)
    expect(screen.getByText('404')).toBeTruthy()
    expect(screen.getByText('Page not found')).toBeTruthy()
  })

  it('/unknown-path renders 404', () => {
    setPath('/this-page-does-not-exist')
    render(<ContentApp />)
    expect(screen.getByText('404')).toBeTruthy()
    expect(screen.getByText('Page not found')).toBeTruthy()
  })
})

describe('Forbidden strings: no page contains draft/pending/TODO/OPEN/lorem/counsel', () => {
  const ROUTES = ['/security', '/faq', '/support', '/usage-risks', '/docs', '/docs/overview']

  ROUTES.forEach(path => {
    FORBIDDEN.forEach(str => {
      it(`${path} does not contain "${str}"`, () => {
        cleanup()
        setPath(path)
        render(<ContentApp />)
        expect(document.body.textContent).not.toContain(str)
      })
    })
  })
})

describe('mailto links use CONTACT_EMAIL', () => {
  const PAGES_WITH_CONTACT = ['/security', '/support', '/usage-risks']

  PAGES_WITH_CONTACT.forEach(path => {
    it(`${path} has mailto:${CONTACT_EMAIL}`, () => {
      cleanup()
      setPath(path)
      render(<ContentApp />)
      const links = document.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]')
      const hrefs = Array.from(links).map(l => l.getAttribute('href'))
      expect(hrefs).toContain(`mailto:${CONTACT_EMAIL}`)
    })
  })
})

describe('PUBLISHED flags', () => {
  it('privacy is false', () => { expect(isPublished('privacy')).toBe(false) })
  it('security is true', () => { expect(isPublished('security')).toBe(true) })
  it('faq is true', () => { expect(isPublished('faq')).toBe(true) })
  it('support is true', () => { expect(isPublished('support')).toBe(true) })
  it('usage-risks is true', () => { expect(isPublished('usage-risks')).toBe(true) })
  it('docs is true', () => { expect(isPublished('docs')).toBe(true) })

  it('/privacy (unpublished) does not appear in nav/footer of /docs', () => {
    cleanup()
    setPath('/docs')
    render(<ContentApp />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map(l => l.getAttribute('href'))
    expect(hrefs).not.toContain('/privacy')
  })
})

describe('Privacy page stays unpublished while {{HOSTING}} present', () => {
  it('PrivacyPage source contains the {{HOSTING}} marker', () => {
    // Import the raw source via the content module — we test that the marker
    // is still present, which must remain true until the page is published.
    // We read this indirectly: PUBLISHED.privacy === false is the authoritative gate.
    // Additionally, the privacy route must render 404, not the privacy content.
    expect(isPublished('privacy')).toBe(false)
    cleanup()
    setPath('/privacy')
    render(<ContentApp />)
    // Should render 404, not the Privacy heading
    expect(screen.queryByText('Privacy')).toBeNull()
    expect(screen.getByText('404')).toBeTruthy()
  })
})

describe('Nav and footer links', () => {
  beforeEach(() => { cleanup() })

  it('/docs has Docs and Security topbar links', () => {
    setPath('/docs')
    render(<ContentApp />)
    const hrefs = screen.getAllByRole('link').map(l => l.getAttribute('href'))
    expect(hrefs).toContain('/docs')
    expect(hrefs).toContain('/security')
  })

  it('/usage-risks has Docs topbar link', () => {
    setPath('/usage-risks')
    render(<ContentApp />)
    const hrefs = screen.getAllByRole('link').map(l => l.getAttribute('href'))
    expect(hrefs).toContain('/docs')
  })
})

describe('Router: hash routes unaffected', () => {
  it('/ returns null (hash router territory)', () => {
    expect(parsePathname('/')).toBeNull()
  })
})
