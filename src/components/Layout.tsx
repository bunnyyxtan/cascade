/**
 * Layout — landing-page chrome only.
 * The authenticated app shell lives in AppShell.tsx.
 * ClaimBanner moved to ClaimableView in AppShell.tsx.
 */
import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { Menu, X, ArrowRight } from 'lucide-react'
import { contentNavigate } from '@/router'
/* NAV_MAX, height and grid owned by CSS (.header-inner) */
const NAV_MAX = 1280

/* ── Logo mark ──────────────────────────────────────────────────────────────
   Single source of truth for the Cascade brand mark.
   Uses the owner-provided PNG artwork directly.

   invert — on dark backgrounds the black mark needs a light tile so it stays
            visible. When true, the image sits on a 4px-padded var(--paper)
            rounded square.
   withText — renders the "cascade." wordmark alongside the mark.
── */
export function LogoMark({
  size     = 32,
  invert   = false,
  withText = false,
}: {
  size?:     number
  invert?:   boolean
  withText?: boolean
}) {
  const mark = (
    <span style={invert ? {
      display:       'inline-flex',
      alignItems:    'center',
      justifyContent:'center',
      padding:       4,
      background:    'var(--paper, #F8F8F5)',
      borderRadius:  Math.round(size * 0.25),
      flexShrink:    0,
    } : { display: 'inline-flex', flexShrink: 0 }}>
      <img
        src="/cascade-logo.png"
        alt=""
        width={size}
        height={size}
        style={{ display: 'block' }}
      />
    </span>
  )

  if (!withText) return mark

  /* wordmark proportions mirror the old LogoMark layout */
  const textSize   = Math.max(12, Math.round(size * 0.625))
  const textColor  = invert ? '#F4F5F1' : 'var(--ink)'
  const dotColor   = '#A1CE48'

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.28) }}>
      {mark}
      <span style={{
        fontFamily:    'var(--font-sans, "Hanken Grotesk", system-ui, sans-serif)',
        fontSize:      textSize,
        fontWeight:    750,
        letterSpacing: '-0.05em',
        lineHeight:    1,
        color:         textColor,
        whiteSpace:    'nowrap',
      }}>
        cascade<span style={{ color: dotColor }}>.</span>
      </span>
    </span>
  )
}

/* ── Layout (landing only) ─────────────────────────────────────────────────── */
interface LayoutProps {
  children:   React.ReactNode
  onNavigate: (view: string, id?: bigint) => void
  fullBleed?: boolean  /* always true on landing — kept for API compat */
}

export function Layout({ children, onNavigate }: LayoutProps) {
  const { isConnected } = useAccount()
  const [mobileOpen, setMobileOpen] = useState(false)

  /* Landing nav items — scroll anchors, workspace link, and pathname links */
  const navItems = [
    { label: 'How it works',  anchor: 'how-it-works' },
    { label: 'The protocol',  anchor: 'the-protocol' },
    { label: 'The workspace', view: 'explore' },
    { label: 'Docs',          path: '/docs' },
    { label: 'Security',      path: '/security' },
  ] as const

  function handleNavClick(item: typeof navItems[number]) {
    setMobileOpen(false)
    if ('path' in item) {
      contentNavigate(item.path)
    } else if ('view' in item) {
      onNavigate(item.view)
    } else {
      onNavigate('home')
      setTimeout(() => {
        document.getElementById(item.anchor)?.scrollIntoView({ behavior: 'smooth' })
      }, 80)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Landing header ──────────────────────────────────────────────────── */}
      <header className="site-header" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(248,248,245,.96)',
        borderBottom: '1px solid rgba(217,220,211,.6)',
      }}>
        <div className="header-inner" style={{ maxWidth: NAV_MAX, margin: '0 auto', display: 'grid', alignItems: 'center' }}>

          {/* Col 1: Brand */}
          <button
            onClick={() => onNavigate('home')}
            aria-label="Cascade home"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, justifySelf: 'start' }}
          >
            <LogoMark size={32} withText />
          </button>

          {/* Col 2: Center nav (hidden ≤920px) */}
          <nav aria-label="Main navigation" className="header-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {navItems.map(item => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                className="layout-nav-btn"
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Col 3: Right cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifySelf: 'end' }}>

            {/* BUILT ON ARC — not connected */}
            {!isConnected && (
              <div className="header-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#A5D83D', display: 'inline-block', flexShrink: 0 }} />
                <span className="layout-arc-label">Built on Arc</span>
              </div>
            )}

            {/* Open workspace button */}
            <button
              className="btn btn-sm header-workspace-btn"
              onClick={() => onNavigate('explore')}
              style={{ gap: 6, whiteSpace: 'nowrap' }}
            >
              {isConnected ? 'Workspace' : 'Open workspace'}
              <ArrowRight className="btn-arrow" style={{ width: 12, height: 12 }} />
            </button>

            {/* Mobile hamburger */}
            <button
              className="nav-mobile-btn"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{
                background: 'var(--white)', border: '1px solid var(--line)',
                borderRadius: 9, cursor: 'pointer', width: 37, height: 37,
                display: 'none', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink)', flexShrink: 0,
              }}
            >
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="nav-mobile-drawer" style={{
            position: 'absolute', top: 'var(--nav-h)', left: 0, right: 0, zIndex: 49,
            background: 'rgba(248,248,245,.98)', borderBottom: '1px solid var(--line)',
            padding: '0 17px 16px',
          }}>
            {navItems.map(item => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item)}
                className="layout-mobile-nav-btn"
              >
                {item.label}
              </button>
            ))}
            <div style={{ paddingTop: 14 }}>
              <ConnectKitButton />
            </div>
            <button
              onClick={() => { onNavigate('explore'); setMobileOpen(false) }}
              className="layout-mobile-ws-btn"
            >
              Open workspace
            </button>
          </div>
        )}
      </header>

      {/* Main — full bleed for landing */}
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  )
}
