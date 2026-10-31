/**
 * LegalLayout — centred 680px reading column for short legal/notice pages.
 * No draft banners, no PendingNotice, no effective-date header.
 */
import { ChevronRight } from 'lucide-react'
import { LogoMark } from '@/components/Layout'
import { DocsFooter } from '@/components/DocsFooter'
import { contentNavigate } from '@/router'

interface Section { id: string; title: string }

interface LegalLayoutProps {
  title:        string
  sections:     Section[]
  children:     React.ReactNode
  onHome:       () => void
  lastUpdated?: string   // e.g. "31 Oct 2026"
}

export function LegalLayout({ title, sections, children, onHome, lastUpdated }: LegalLayoutProps) {
  function navTo(path: string) { contentNavigate(path) }

  return (
    <div className="legal-root">
      {/* Top bar */}
      <header className="docs-topbar">
        <div className="docs-topbar-inner">
          <button onClick={onHome} className="docs-topbar-logo" aria-label="Cascade home">
            <LogoMark size={28} withText />
          </button>
          <div className="docs-topbar-links">
            <a href="/docs" onClick={e => { e.preventDefault(); navTo('/docs') }}
              className="docs-topbar-link">Docs</a>
            <a href="/security" onClick={e => { e.preventDefault(); navTo('/security') }}
              className="docs-topbar-link">Security</a>
          </div>
        </div>
      </header>

      <main className="legal-main" id="main-content">
        <div className="legal-inner">
          {/* Breadcrumb */}
          <nav className="docs-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: 24 }}>
            <a href="/" onClick={e => { e.preventDefault(); onHome() }} className="docs-breadcrumb-link">Home</a>
            <ChevronRight size={12} aria-hidden="true" />
            <span className="docs-breadcrumb-current">{title}</span>
          </nav>

          {/* Document header */}
          <h1 className="legal-title">{title}</h1>
          {lastUpdated && (
            <p className="legal-last-updated">Last updated: {lastUpdated}</p>
          )}

          {/* TOC card */}
          {sections.length > 0 && (
            <nav className="legal-toc" aria-label="Contents">
              <p className="legal-toc-title">Contents</p>
              <ol className="legal-toc-list">
                {sections.map((s, i) => (
                  <li key={s.id} className="legal-toc-item">
                    <a href={`#${s.id}`} className="legal-toc-link">
                      <span className="legal-toc-num">{i + 1}.</span> {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {/* Body */}
          <div className="legal-body">
            {children}
          </div>
        </div>
      </main>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '0 32px' }}>
        <DocsFooter />
      </div>
    </div>
  )
}

/** Numbered section with anchor. */
export function LegalSection({
  id, num, title, children,
}: {
  id: string; num: number; title: string; children: React.ReactNode
}) {
  return (
    <section id={id} className="legal-section">
      <h2 className="legal-section-h">
        <span className="legal-section-num">{num}.</span> {title}
        <a href={`#${id}`} className="legal-section-anchor" aria-label={`Link to section ${num}`}>#</a>
      </h2>
      {children}
    </section>
  )
}
