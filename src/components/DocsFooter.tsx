/**
 * DocsFooter — compact footer for documentation and legal pages.
 * Replaces the full SiteFooter on content pages.
 * All layout is inline styles to avoid class-inheritance issues.
 */
import { AlertCircle } from 'lucide-react'
import { CONTACT_MAILTO, CONTACT_EMAIL, isPublished } from '@/content/site'

const CURRENT_YEAR = new Date().getFullYear()
const REPO = 'https://github.com/bunnyyxtan/cascade'

// Colours — live on the --paper background of docs pages
const TEXT_MUTE  = 'var(--muted,    #70776C)'
const TEXT_LINK  = 'var(--ok,       #27744E)'
const BORDER_CLR = 'var(--line,     #E3E6DD)'
const TEXT_MAIN  = 'var(--ink,      #151714)'

export function DocsFooter() {
  const linkStyle: React.CSSProperties = {
    color: TEXT_LINK,
    textDecoration: 'none',
    fontSize: '0.8125rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  }

  const muteLinkStyle: React.CSSProperties = {
    color: TEXT_MUTE,
    textDecoration: 'none',
    fontSize: '0.8125rem',
  }

  return (
    <footer
      aria-label="Documentation footer"
      style={{
        borderTop: `1px solid ${BORDER_CLR}`,
        marginTop: 48,
        padding: '28px 0 40px',
      }}
    >
      {/* ── action row ─────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}>
        {/* Report a problem */}
        <a
          href={`${CONTACT_MAILTO}?subject=Docs%20feedback`}
          style={{ ...linkStyle, color: TEXT_MUTE }}
          aria-label={`Report a documentation problem (email ${CONTACT_EMAIL})`}
        >
          <AlertCircle size={14} aria-hidden />
          Report a problem
        </a>
      </div>

      {/* ── nav links ───────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px 20px',
        marginBottom: 20,
      }}>
        {isPublished('security') && (
          <a href="/security" style={muteLinkStyle}>Security</a>
        )}
        {isPublished('usage-risks') && (
          <a href="/usage-risks" style={muteLinkStyle}>Usage &amp; Risks</a>
        )}
        {isPublished('privacy') && (
          <a href="/privacy" style={muteLinkStyle}>Privacy</a>
        )}
        {isPublished('support') && (
          <a href="/support" style={muteLinkStyle}>Support</a>
        )}
      </div>

      {/* ── copyright ───────────────────────────────────────── */}
      <p style={{
        fontSize: '0.75rem',
        color: TEXT_MUTE,
        margin: 0,
        lineHeight: 1.5,
      }}>
        © {CURRENT_YEAR} Cascade ·{' '}
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          style={{ color: TEXT_MAIN, textDecoration: 'none', fontSize: '0.75rem' }}
        >
          Open source on GitHub
        </a>
      </p>
    </footer>
  )
}
