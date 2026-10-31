/**
 * SiteFooter — dark footer used on the Landing page only.
 *
 * All layout is driven by inline styles so it cannot be broken by any
 * Tailwind purge, CSS class inheritance from .docs-root / .landing, or
 * specificity conflict. The only class on the outer element is the semantic
 * <footer> tag itself.
 */
import { useState, useRef } from 'react'
import { Github, Mail, Copy, ExternalLink } from 'lucide-react'
import { LogoMark } from './Layout'
import { CASCADE_ADDRESS, TARGET_CHAIN, addrUrl } from '@/lib/contracts'
import { NETWORK_LABEL } from '@/lib/network'
import { CONTACT_EMAIL, CONTACT_MAILTO, isPublished } from '@/content/site'
import { toastCopied, toastCopyFailed } from '@/lib/toast'

const CURRENT_YEAR = new Date().getFullYear()

// ─── colour constants ────────────────────────────────────────────────────────
const BG        = '#1B1F1A'
const TEXT_MAIN = '#E9ECE4'
const TEXT_MUTE = '#9FA89B'
const TEXT_DIM  = '#8C9488'
const TEXT_HEAD = '#A9B1A2'
const BORDER    = 'rgba(255,255,255,.10)'
const BORDER_MED= '#353933'
const LIME      = '#A5D83D'

// ─── shared micro-styles ─────────────────────────────────────────────────────
const S = {
  footer: {
    background: BG,
    color: TEXT_MAIN,
    padding: '56px 0 32px',
    marginTop: 0,
  } as React.CSSProperties,

  wrap: {
    maxWidth: 1192,
    margin: '0 auto',
    padding: '0 36px',
  } as React.CSSProperties,

  /* ── top row: logo+desc / CTA ── */
  topRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 32,
    marginBottom: 48,
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  brand: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    maxWidth: 360,
  } as React.CSSProperties,

  desc: {
    fontSize: '0.875rem',
    lineHeight: 1.65,
    color: TEXT_MUTE,
    margin: 0,
  } as React.CSSProperties,

  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    height: 42,
    padding: '0 20px',
    borderRadius: 10,
    background: TEXT_MAIN,
    color: BG,
    fontFamily: 'var(--font-sans, "Hanken Grotesk", system-ui, sans-serif)',
    fontSize: '0.875rem',
    fontWeight: 650,
    letterSpacing: '-0.01em',
    textDecoration: 'none',
    border: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
    alignSelf: 'flex-start',
  } as React.CSSProperties,

  /* ── divider ── */
  divider: {
    borderTop: `1px solid ${BORDER_MED}`,
    margin: '0 0 40px',
  } as React.CSSProperties,

  /* ── 4-col link grid ── */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 32,
    marginBottom: 40,
  } as React.CSSProperties,

  colHead: {
    display: 'block',
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.10em',
    textTransform: 'uppercase' as const,
    color: TEXT_HEAD,
    marginBottom: 14,
  } as React.CSSProperties,

  colLinks: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
  } as React.CSSProperties,

  link: {
    fontSize: '0.9375rem',
    color: TEXT_MAIN,
    textDecoration: 'none',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-sans, "Hanken Grotesk", system-ui, sans-serif)',
    textAlign: 'left' as const,
    lineHeight: 1.4,
  } as React.CSSProperties,

  /* ── network column pieces ── */
  netPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: `1px solid ${BORDER_MED}`,
    borderRadius: 6,
    padding: '5px 9px',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#B4BAAB',
    width: 'fit-content',
  } as React.CSSProperties,

  netDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: LIME,
    flexShrink: 0,
  } as React.CSSProperties,

  addrRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,

  addrMono: {
    fontFamily: 'var(--font-mono, "DM Mono", monospace)',
    fontSize: '0.75rem',
    color: TEXT_MUTE,
  } as React.CSSProperties,

  addrBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: TEXT_DIM,
    padding: '2px 3px',
    borderRadius: 3,
    transition: 'color 120ms ease',
  } as React.CSSProperties,

  addrLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: TEXT_DIM,
    textDecoration: 'none',
  } as React.CSSProperties,

  chainId: {
    fontSize: '0.75rem',
    color: TEXT_DIM,
  } as React.CSSProperties,

  /* ── bottom bar ── */
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap' as const,
    paddingTop: 20,
    borderTop: `1px solid ${BORDER}`,
  } as React.CSSProperties,

  copy: {
    fontSize: '0.75rem',
    color: TEXT_DIM,
    lineHeight: 1.5,
  } as React.CSSProperties,

  icons: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  } as React.CSSProperties,

  iconLink: {
    display: 'inline-flex',
    alignItems: 'center',
    color: TEXT_DIM,
    textDecoration: 'none',
  } as React.CSSProperties,
}

// ─── module-level helper — must not be defined inside SiteFooter ────────────
function FtrLink({ href, onClick, children }: {
  href?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  if (onClick) return <button style={S.link} onClick={onClick}>{children}</button>
  return <a style={S.link} href={href}>{children}</a>
}

interface Props {
  onNavigate?: (view: string) => void
}

export function SiteFooter({ onNavigate }: Props) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const addrRef = useRef<HTMLSpanElement>(null)

  function copyAddress() {
    if (!CASCADE_ADDRESS) return
    navigator.clipboard.writeText(CASCADE_ADDRESS).then(() => {
      setCopyState('copied')
      setTimeout(() => setCopyState('idle'), 1600)
      toastCopied('Address copied')
    }).catch(() => {
      setCopyState('failed')
      setTimeout(() => setCopyState('idle'), 1600)
      toastCopyFailed()
      if (addrRef.current) {
        const sel = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(addrRef.current)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    })
  }

  const copied     = copyState === 'copied'
  const copyFailed = copyState === 'failed'

  // CTA — navigate or href
  const cta = onNavigate
    ? (
      <button style={S.cta} onClick={() => onNavigate('explore')}>
        Open workspace
      </button>
    )
    : (
      <a href="/#explore" style={S.cta}>
        Open workspace
      </a>
    )

  return (
    <footer style={S.footer} aria-label="Site footer">
      <div style={S.wrap}>

        {/* ── Top row: branding + CTA ─────────────────────────────── */}
        <div style={S.topRow}>
          <div style={S.brand}>
            <LogoMark size={30} invert withText />
            <p style={S.desc}>
              Programmable financial authority. Fund an outcome, delegate
              within a clear limit, settle in USDC — enforced by an
              immutable contract.
            </p>
          </div>
          {cta}
        </div>

        {/* ── divider ─────────────────────────────────────────────── */}
        <div role="separator" style={S.divider} />

        {/* ── Link grid ───────────────────────────────────────────── */}
        <div style={S.grid} className="sf-grid">
          {/* Product */}
          <div>
            <span style={S.colHead}>Product</span>
            <div style={S.colLinks}>
              <FtrLink onClick={onNavigate ? () => onNavigate('explore') : undefined} href="/#explore">Workspace</FtrLink>
              <FtrLink onClick={onNavigate ? () => onNavigate('create') : undefined} href="/#create">New objective</FtrLink>
              <FtrLink onClick={onNavigate ? () => onNavigate('activity') : undefined} href="/#activity">Activity</FtrLink>
            </div>
          </div>

          {/* Resources */}
          <div>
            <span style={S.colHead}>Resources</span>
            <div style={S.colLinks}>
              <FtrLink href="/docs">Documentation</FtrLink>
              <FtrLink href="/faq">FAQ</FtrLink>
              <FtrLink href="/support">Support</FtrLink>
            </div>
          </div>

          {/* Trust */}
          <div>
            <span style={S.colHead}>Trust</span>
            <div style={S.colLinks}>
              <FtrLink href="/security">Security</FtrLink>
              <FtrLink href="/usage-risks">Usage &amp; Risks</FtrLink>
              {isPublished('privacy') && <FtrLink href="/privacy">Privacy</FtrLink>}
            </div>
          </div>

          {/* Network */}
          <div>
            <span style={S.colHead}>Network</span>
            <div style={S.colLinks}>
              <span style={S.netPill}>
                <span style={S.netDot} aria-hidden />
                {NETWORK_LABEL}
              </span>
              {CASCADE_ADDRESS && (
                <div style={S.addrRow}>
                  <span ref={addrRef} style={S.addrMono}>
                    {CASCADE_ADDRESS.slice(0, 6)}…{CASCADE_ADDRESS.slice(-4)}
                  </span>
                  <button
                    onClick={copyAddress}
                    style={{
                      ...S.addrBtn,
                      color: copied ? LIME : copyFailed ? '#F28B7A' : TEXT_DIM,
                    }}
                    aria-label="Copy contract address"
                    title={copied ? 'Copied' : 'Copy address'}
                  >
                    <Copy size={12} aria-hidden />
                  </button>
                  <a
                    href={addrUrl(CASCADE_ADDRESS)}
                    target="_blank"
                    rel="noreferrer"
                    style={S.addrLink}
                    aria-label="View on explorer"
                    title="Explorer"
                  >
                    <ExternalLink size={12} aria-hidden />
                  </a>
                </div>
              )}
              <span style={S.chainId}>Chain {TARGET_CHAIN.id}</span>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ───────────────────────────────────────────── */}
        <div style={S.bottomBar}>
          <span style={S.copy}>
            © {CURRENT_YEAR} Cascade
          </span>
          <div style={S.icons}>
            <a
              href="https://github.com/bunnyyxtan/cascade"
              target="_blank"
              rel="noreferrer"
              style={S.iconLink}
              aria-label="GitHub repository"
            >
              <Github size={16} aria-hidden />
            </a>
            <a
              href={CONTACT_MAILTO}
              style={S.iconLink}
              aria-label={`Email ${CONTACT_EMAIL}`}
            >
              <Mail size={16} aria-hidden />
            </a>
          </div>
        </div>

      </div>
    </footer>
  )
}
