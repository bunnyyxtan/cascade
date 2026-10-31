/**
 * DocsLayout — three-column layout for documentation pages.
 * Left: 260px sidebar with grouped sections + Search.
 * Center: article, max 720px.
 * Right: sticky TOC (h2/h3), hidden under 1280px.
 */
import { useState, useEffect } from 'react'
import { Menu, X, ChevronRight } from 'lucide-react'
import { LogoMark } from '@/components/Layout'
import { DocsFooter } from '@/components/DocsFooter'
import { contentNavigate } from '@/router'
import { SearchButton } from './Search'
import type { Heading } from './mdRenderer'
import type { DocEntry } from './docsRegistry'
import { DOCS_ENTRIES } from './docsRegistry'

interface DocsLayoutProps {
  slug:       string
  title:      string
  headings:   Heading[]
  docs:       DocEntry[]
  children:   React.ReactNode
  onHome:     () => void
}

export function DocsLayout({ slug, title, headings, docs, children, onHome }: DocsLayoutProps) {
  // mobileNavOpen is tied to the slug it was opened on; different slug = closed
  const [navOpenSlug, setNavOpenSlug] = useState<string | null>(null)
  const mobileNavOpen = navOpenSlug === slug
  const [activeHash, setActiveHash] = useState('')

  // Track scroll position for TOC highlight
  useEffect(() => {
    function onScroll() {
      const headingEls = document.querySelectorAll<HTMLElement>('.md-h2, .md-h3')
      let active = ''
      for (const el of headingEls) {
        if (el.getBoundingClientRect().top <= 120) active = el.id
      }
      setActiveHash(active)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Sidebar sections
  const sections = [...new Set(DOCS_ENTRIES.map(e => e.section))]

  // Prev / next
  const allSlugs = DOCS_ENTRIES.map(e => e.slug)
  const currentIdx = allSlugs.indexOf(slug)
  const prevEntry = currentIdx > 0 ? DOCS_ENTRIES[currentIdx - 1] : null
  const nextEntry = currentIdx < DOCS_ENTRIES.length - 1 ? DOCS_ENTRIES[currentIdx + 1] : null

  function navTo(path: string) { contentNavigate(path); setNavOpenSlug(null) }

  const sidebar = (
    <nav className="docs-sidebar" aria-label="Documentation navigation">
      <div className="docs-sidebar-search">
        <SearchButton docs={docs} />
      </div>
      {sections.map(section => (
        <div key={section} className="docs-sidebar-section">
          <span className="docs-sidebar-section-label">{section}</span>
          {DOCS_ENTRIES.filter(e => e.section === section).map(entry => (
            <a
              key={entry.slug}
              href={`/docs/${entry.slug}`}
              onClick={e => { e.preventDefault(); navTo(`/docs/${entry.slug}`) }}
              className={`docs-sidebar-link${entry.slug === slug ? ' docs-sidebar-link--active' : ''}`}
              aria-current={entry.slug === slug ? 'page' : undefined}
            >
              {entry.title}
            </a>
          ))}
        </div>
      ))}
    </nav>
  )

  return (
    <div className="docs-root">
      {/* Top bar */}
      <header className="docs-topbar">
        <div className="docs-topbar-inner">
          <button
            onClick={onHome}
            className="docs-topbar-logo"
            aria-label="Cascade home"
          >
            <LogoMark size={28} withText />
          </button>

          <div className="docs-topbar-links">
            <a href="/docs" onClick={e => { e.preventDefault(); navTo('/docs') }}
              className="docs-topbar-link">Docs</a>
            <a href="/security" onClick={e => { e.preventDefault(); navTo('/security') }}
              className="docs-topbar-link">Security</a>
          </div>

          <button
            className="docs-mobile-menu-btn"
            onClick={() => setNavOpenSlug(v => v === slug ? null : slug)}
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Mobile nav drawer */}
        {mobileNavOpen && (
          <div className="docs-mobile-nav">{sidebar}</div>
        )}
      </header>

      <div className="docs-body">
        {/* Desktop sidebar */}
        <div className="docs-sidebar-col">
          {sidebar}
        </div>

        {/* Article */}
        <main className="docs-article" id="main-content">
          {/* Breadcrumbs */}
          <nav className="docs-breadcrumb" aria-label="Breadcrumb">
            <a href="/" onClick={e => { e.preventDefault(); onHome() }} className="docs-breadcrumb-link">Home</a>
            <ChevronRight size={12} aria-hidden="true" />
            <a href="/docs" onClick={e => { e.preventDefault(); navTo('/docs') }} className="docs-breadcrumb-link">Docs</a>
            {slug !== 'overview' && (
              <>
                <ChevronRight size={12} aria-hidden="true" />
                <span className="docs-breadcrumb-current">{title}</span>
              </>
            )}
          </nav>

          {/* Article body */}
          <article className="docs-article-body">
            {children}
          </article>

          {/* Prev / next */}
          {(prevEntry || nextEntry) && (
            <nav className="docs-prevnext" aria-label="Page navigation">
              {prevEntry ? (
                <a
                  href={`/docs/${prevEntry.slug}`}
                  onClick={e => { e.preventDefault(); navTo(`/docs/${prevEntry.slug}`) }}
                  className="docs-prevnext-link docs-prevnext-link--prev"
                >
                  <span className="docs-prevnext-label">← Previous</span>
                  <span className="docs-prevnext-title">{prevEntry.title}</span>
                </a>
              ) : <span />}
              {nextEntry ? (
                <a
                  href={`/docs/${nextEntry.slug}`}
                  onClick={e => { e.preventDefault(); navTo(`/docs/${nextEntry.slug}`) }}
                  className="docs-prevnext-link docs-prevnext-link--next"
                >
                  <span className="docs-prevnext-label">Next →</span>
                  <span className="docs-prevnext-title">{nextEntry.title}</span>
                </a>
              ) : <span />}
            </nav>
          )}
        </main>

        {/* Right TOC (≥1280px only) */}
        {headings.length > 0 && (
          <aside className="docs-toc" aria-label="On this page">
            <p className="docs-toc-title">On this page</p>
            <ul className="docs-toc-list">
              {headings.map(h => (
                <li key={h.id} className={`docs-toc-item docs-toc-item--h${h.level}${activeHash === h.id ? ' docs-toc-item--active' : ''}`}>
                  <a href={`#${h.id}`} className="docs-toc-link">{h.text}</a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
      {/* Docs footer — compact, no full site footer */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 40px' }}>
        <DocsFooter
          slug={slug !== 'overview' ? slug : undefined}
          isGuide={DOCS_ENTRIES.find(e => e.slug === slug)?.section !== 'For developers'}
        />
      </div>
    </div>
  )
}
