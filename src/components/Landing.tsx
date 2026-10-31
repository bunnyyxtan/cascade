import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { LogoMark } from './Layout'
import { SiteFooter } from './SiteFooter'

interface Props { onNavigate: (view: string, id?: bigint) => void }

/* ── Container / layout helpers ────────────────────────────────────────────── */
const C = 1192   /* max content width */
function Wrap({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ maxWidth: C, margin: '0 auto', padding: '0 36px', ...style }}
      className="landing-wrap">
      {children}
    </div>
  )
}

/* ── Scroll-reveal hook ─────────────────────────────────────────────────────── */
function useFadeUp(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.style.opacity = '1'
      return
    }
    el.style.opacity = '0'
    el.style.transform = 'translateY(24px)'
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transition = 'opacity 700ms cubic-bezier(.22,1,.36,1), transform 700ms cubic-bezier(.22,1,.36,1)'
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          obs.disconnect()
        }
      },
      { threshold: 0.06 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
}
function Reveal({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useFadeUp(ref)
  return <div ref={ref} style={style} className={className}>{children}</div>
}

/* ── Inline icons ───────────────────────────────────────────────────────────── */
function Arrow({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 13 13" fill="none" aria-hidden className="btn-arrow" style={{ display: 'inline-block' }}>
      <path d="M2 6.5h9M7.5 3l3.5 3.5L7.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ChevSmall() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden style={{ display: 'inline-block' }}>
      <path d="M2 4l3.5 3.5L9 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function Check22() {
  return (
    <span style={{ width: 22, height: 22, borderRadius: 7, border: '1px solid #C5D1B6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path d="M2 5.2L4 7.2L8 3" stroke="#5A7A47" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  )
}
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="5.5" stroke="#9EAA96" strokeWidth="1.2"/>
      <path d="M6.5 5.5v3.5M6.5 3.9v.1" stroke="#9EAA96" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   1. SHOWCASE
══════════════════════════════════════════════════════════════════════════════ */
const STEPS = [
  {
    label: '01 Fund', eyebrow: '01 / AUTHORITY',
    h3: 'Fund the outcome.',
    copy: '10 USDC starts in one funded objective. The client chooses how much a manager is allowed to allocate.',
  },
  {
    label: '02 Delegate', eyebrow: '02 / DELEGATION',
    h3: 'Delegate with clear limits.',
    copy: 'The manager distributes up to 7 USDC across specialists. Each child commitment has its own approver and deadline.',
  },
  {
    label: '03 Settle', eyebrow: '03 / SETTLEMENT',
    h3: 'Settle with certainty.',
    copy: 'Approved work becomes claimable USDC immediately. Failed commitments return unspent funds. The reserve is untouched throughout.',
  },
]

function Showcase() {
  const [step, setStep] = useState(0)
  const s = STEPS[step]

  /* Board state per step */
  const board = [
    { auth: '7.00', authLabel: 'Available to delegate', authLift: false, authLime: false,
      prot: '3.00', protLabel: 'Not delegatable' },
    { auth: '7.00', authLabel: 'Delegating…',            authLift: true,  authLime: true,
      prot: '3.00', protLabel: 'Not delegatable' },
    { auth: '4.00', authLabel: 'After 3.00 settled',     authLift: false, authLime: false,
      prot: '3.00', protLabel: 'Not delegatable' },
  ][step]

  const replay = useCallback(() => {
    setStep(0)
    const t1 = setTimeout(() => setStep(1), 600)
    const t2 = setTimeout(() => setStep(2), 1400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <div style={{
      maxWidth: 1120, margin: '75px auto 0',
      background: 'var(--white)',
      border: '1px solid #DADDD4',
      borderRadius: 17,
      padding: 18,
      boxShadow: 'var(--shadow)',
    }} className="showcase-mobile-pad">

      {/* Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 14, marginBottom: 0, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 34, height: 34, background: 'var(--lime)', borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 4.5v8c0 3 2.2 5.2 5.2 5.2H16"/><path d="m13 8 5 5-5 5"/><path d="M16 18h3"/>
            </svg>
          </span>
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Capital, in motion.</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 1 }}>A single objective across a network of work</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="showcase-label-desktop" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)' }}>
            Interactive illustration
          </span>
          <span style={{ background: 'var(--tint)', border: '1px solid var(--line)', borderRadius: 100, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>
            10 USDC example
          </span>
        </div>
      </div>

      {/* Stage */}
      <div style={{ display: 'grid', gap: 44, padding: '38px 17px 28px', alignItems: 'start' }} className="showcase-grid showcase-stage">

        {/* Left: copy */}
        <div className="showcase-copy">
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: 14 }}>
            {s.eyebrow}
          </p>
          <h3 style={{ fontSize: 'clamp(2.3125rem, 4.8vw, 3.875rem)', fontWeight: 650, letterSpacing: '-0.067em', lineHeight: 1.03, color: 'var(--ink)', marginBottom: 16 }}>
            {s.h3}
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--secondary)', lineHeight: 1.7, maxWidth: 380, marginBottom: 24 }}>
            {s.copy}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} className="showcase-steps">
            {STEPS.map((st, i) => (
              <button
                key={st.label}
                aria-pressed={step === i}
                onClick={() => setStep(i)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  padding: '9px 11px', borderRadius: 7, cursor: 'pointer',
                  border: `1px solid ${step === i ? 'transparent' : 'var(--line)'}`,
                  background: step === i ? '#21251F' : 'transparent',
                  color: step === i ? 'var(--lime)' : 'var(--secondary)',
                  transition: 'background 250ms var(--ease), color 250ms var(--ease)',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: board */}
        <div className="showcase-board-wrap">
        <div style={{ background: '#F6F8F2', border: '1px solid #E6EADF', borderRadius: 13, padding: 24 }} className="showcase-board">
          {/* Root node — fix 5: white amount, left-aligned content */}
          <div style={{ width: '70%', margin: '0 auto', background: '#20241E', borderRadius: 11, padding: '16px 20px' }} className="showcase-root">
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#AEB7A6', marginBottom: 8 }}>
              Root objective
            </p>
            <p style={{ fontSize: '1.6875rem', fontWeight: 650, color: '#fff', letterSpacing: '-0.06em', lineHeight: 1 }} className="showcase-branch-amt">
              10.00 <span style={{ fontSize: '0.75rem', fontWeight: 450, letterSpacing: 0, color: 'rgba(255,255,255,0.55)' }}>USDC</span>
            </p>
            <p style={{ fontSize: '0.75rem', color: '#C0C5BD', marginTop: 5 }}>
              Client-funded objective
            </p>
          </div>
          {/* Connector */}
          <div aria-hidden style={{ position: 'relative', height: 36, display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', top: 0, left: '50%', width: 1, height: 18, background: '#B2B9AA', transform: 'translateX(-50%)' }} />
            <div style={{ position: 'absolute', top: 18, left: 'calc(50% - 82px)', right: 'calc(50% - 82px)', height: 1, background: '#B2B9AA' }} />
            <div style={{ position: 'absolute', top: 18, left: 'calc(50% - 82px)', width: 1, height: 18, background: '#B2B9AA' }} />
            <div style={{ position: 'absolute', top: 18, right: 'calc(50% - 82px)', width: 1, height: 18, background: '#B2B9AA' }} />
          </div>
          {/* Child nodes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} className="showcase-branches">
            <div className="showcase-branch" style={{
              background: board.authLime ? 'var(--lime)' : 'var(--white)',
              border: '1px solid var(--line)',
              borderRadius: 9, padding: '14px 14px',
              transform: board.authLift ? 'translateY(-3px)' : 'none',
              transition: 'background 450ms var(--ease), transform 450ms var(--ease)',
            }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: board.authLime ? 'rgba(21,23,20,0.5)' : 'var(--secondary)', marginBottom: 6 }}>
                Authorized
              </p>
              <p className="showcase-branch-amt" style={{ fontSize: '1.375rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.055em', lineHeight: 1 }}>
                {board.auth}
              </p>
              <p style={{ fontSize: '0.75rem', color: board.authLime ? 'rgba(21,23,20,0.55)' : 'var(--muted)', marginTop: 4, transition: 'color 450ms var(--ease)' }}>
                {board.authLabel}
              </p>
            </div>
            <div className="showcase-branch" style={{ background: 'var(--lime)', border: '1px solid var(--line)', borderRadius: 9, padding: '14px 14px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(21,23,20,0.5)', marginBottom: 6 }}>
                Protected
              </p>
              <p className="showcase-branch-amt" style={{ fontSize: '1.375rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.055em', lineHeight: 1 }}>
                {board.prot}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'rgba(21,23,20,0.55)', marginTop: 4 }}>{board.protLabel}</p>
            </div>
          </div>
        </div>
        </div>{/* end showcase-board-wrap */}
      </div>

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--line)', paddingTop: 13, marginTop: 4, gap: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--muted)' }}>
          <InfoIcon />
          Concept demonstration only. No wallet or blockchain operations.
        </span>
        <button onClick={replay} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)' }}>
          Replay interaction
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
            <path d="M11 6.5a4.5 4.5 0 1 1-1-2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M10 2.5v1.7H8.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. PROOF STRIP
══════════════════════════════════════════════════════════════════════════════ */
const PROOF = [
  { title: 'One escrow',         body: 'Capital stays accounted for across nested commitments.' },
  { title: 'Defined authority',  body: 'The client determines the manager\'s spending limit.' },
  { title: 'Independent claims', body: 'Approved work becomes withdrawable USDC.' },
]

/* ══════════════════════════════════════════════════════════════════════════════
   3. BOUNDARY / MANDATE CALCULATOR
══════════════════════════════════════════════════════════════════════════════ */
function MandateCard() {
  const [limit, setLimit] = useState(7)
  const total = 10
  const reserve = total - limit
  const delegPct = (limit / total) * 100

  return (
    <div style={{ background: 'var(--white)', border: '1px solid var(--line)', borderRadius: 17, padding: '28px 30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <p style={{ fontSize: '0.9375rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.025em' }}>Set the mandate</p>
        <span style={{ background: 'var(--tint)', border: '1px solid var(--line)', borderRadius: 100, padding: '3px 10px', fontSize: '0.75rem', color: 'var(--secondary)', cursor: 'default' }}>
          Try adjusting
        </span>
      </div>

      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: 4 }}>
        Total funding
      </p>
      <p style={{ fontSize: '4rem', fontWeight: 650, letterSpacing: '-0.07em', lineHeight: 1, color: 'var(--ink)', marginBottom: 20, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        {total.toFixed(2)}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 400, letterSpacing: 0, color: 'var(--muted)' }}>USDC</span>
      </p>

      <p style={{ fontSize: '0.8125rem', fontWeight: 650, color: 'var(--ink)', marginBottom: 12 }}>Delegation limit</p>

      {/* Range slider */}
      <div style={{ position: 'relative', marginBottom: 6 }}>
        <input
          type="range" min={0} max={total} step={0.5}
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          className="mandate-range"
          aria-label="Delegation limit"
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>0 USDC</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>10 USDC</span>
      </div>

      {/* Allocation bar */}
      <div style={{ display: 'flex', gap: delegPct > 0 && delegPct < 100 ? 3 : 0, borderRadius: 6, overflow: 'hidden', height: 67, transition: 'gap 450ms var(--ease)' }}>
        <div style={{
          background: '#20241D', flex: delegPct, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          padding: delegPct > 0 ? '0 20px' : 0,
          transition: 'flex 450ms var(--ease), padding 450ms var(--ease)',
          minWidth: delegPct > 0 ? 48 : 0, overflow: 'hidden',
        }}>
          {limit > 0 && <span style={{ fontSize: '1.375rem', fontWeight: 650, color: '#fff', letterSpacing: '-0.05em', whiteSpace: 'nowrap' }}>{limit.toFixed(2)}</span>}
        </div>
        <div style={{
          background: 'var(--lime)', flex: 100 - delegPct, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: reserve > 0 ? '0 20px' : 0,
          transition: 'flex 450ms var(--ease), padding 450ms var(--ease)',
          minWidth: reserve > 0 ? 48 : 0, overflow: 'hidden',
        }}>
          {reserve > 0 && <span style={{ fontSize: '1.375rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.05em', whiteSpace: 'nowrap' }}>{reserve.toFixed(2)}</span>}
        </div>
      </div>

      {/* Single legend — 2-col grid, swatch + label on top, value below */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#20241D', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Manager authority</span>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.05em' }}>{limit.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>USDC</span></p>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--lime)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Protected at root</span>
          </div>
          <p style={{ fontSize: '1.25rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.05em' }}>{reserve.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 400 }}>USDC</span></p>
        </div>
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 14, lineHeight: 1.6 }}>
        The manager can allocate up to <strong style={{ color: 'var(--ink)', fontWeight: 650 }}>{limit.toFixed(2)} USDC</strong> without client approval.
      </p>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. DARK PROCESS
══════════════════════════════════════════════════════════════════════════════ */
const PROCESS = [
  {
    n: '01: DEFINE', title: 'Fund with intention.',
    body: 'The client chooses the outcome, assigns a manager, and locks in the spending authority before work starts.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#D9FA71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="12" height="16" rx="2"/>
        <path d="M7 7h6M7 10h6M7 13h3"/>
      </svg>
    ),
  },
  {
    n: '02: DELEGATE', title: 'Build the work tree.',
    body: 'Managers divide authorized funds into new commitments. Each child has its own owner, approver, and deadline.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#D9FA71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3v4M10 7l-4 4M10 7l4 4"/><circle cx="10" cy="2" r="1.5"/><circle cx="6" cy="12" r="1.5"/><circle cx="14" cy="12" r="1.5"/>
      </svg>
    ),
  },
  {
    n: '03: SETTLE', title: 'Approve. Return. Pay.',
    body: 'Approved work creates a claim. Failed work returns unspent capital. The original mandate stays intact.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#D9FA71" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7.5"/><path d="M7 10l2 2 4-4"/>
      </svg>
    ),
  },
]

/* ══════════════════════════════════════════════════════════════════════════════
   5. WORKSPACE PREVIEW (static mock)
══════════════════════════════════════════════════════════════════════════════ */
function WorkspacePreview({ onNavigate: _onNavigate }: { onNavigate: (v: string) => void }) {
  return (
    <div className="preview-frame" style={{ borderRadius: 18, overflow: 'hidden', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', display: 'flex', background: 'var(--white)', minHeight: 440 }}>
      {/* Sidebar */}
      <div className="preview-sidebar" style={{ background: '#F3F5EF', padding: '20px 0', flexShrink: 0, borderRight: '1px solid var(--line)' }}>
        <div style={{ padding: '0 16px', marginBottom: 20 }}>
          <LogoMark size={22} withText />
        </div>
        {['Overview', 'Objectives', 'Activity', 'Claimable'].map((item, i) => (
          <div key={item} style={{ padding: '8px 16px', background: i === 0 ? '#E6ECCA' : 'transparent', borderRadius: i === 0 ? '0 8px 8px 0' : 0, marginRight: 12, cursor: 'default' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: i === 0 ? 600 : 400, color: i === 0 ? 'var(--ink)' : 'var(--muted)' }}>{item}</span>
          </div>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex: 1, padding: '20px 22px', minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: 4 }}>
          A cleaner way to manage capital
        </p>
        <p style={{ fontSize: '1.0625rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.04em', marginBottom: 3 }}>Workspace / Overview</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 16 }}>Design preview with illustrative USDC amounts.</p>
        {/* Metric tiles */}
        <div className="preview-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          {[['Funded','10.00'],['Mandate','7.00'],['Protected','3.00']].map(([l,v]) => (
            <div key={l} style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '10px 12px' }}>
              <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 4 }}>{l}</p>
              <p className="preview-metric-v" style={{ fontSize: '1.125rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.05em' }}>{v}</p>
            </div>
          ))}
        </div>
        {/* Flow row */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 9, padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: '0.8125rem', fontWeight: 650, color: 'var(--ink)' }}>Market research brief</p>
            <span style={{ background: '#E6ECCA', color: '#2C6A3F', fontSize: '0.75rem', fontWeight: 600, padding: '2px 7px', borderRadius: 5 }}>Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {[['Objective','10.00',false], null, ['Specialists','7.00',true], null, ['Reserve','3.00',false]].map((item, i) => (
              item === null
                ? <span key={i} className="preview-flow-arrow" style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>→</span>
                : <div key={i} className="preview-flow-tile" style={{ background: item[2] ? 'var(--lime-soft)' : 'var(--tint)', borderRadius: 7, padding: '8px 10px', flex: '1 1 90px', minWidth: 90 }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 3 }}>{item[0] as string}</p>
                    <p style={{ fontSize: '1rem', fontWeight: 650, color: 'var(--ink)', letterSpacing: '-0.04em' }}>{item[1] as string}</p>
                  </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   6. FAQ
══════════════════════════════════════════════════════════════════════════════ */
const FAQ_ITEMS = [
  { q: 'What is the protected reserve?', a: 'When you create a root objective, you set a delegation limit. The difference between the total budget and this limit is the protected reserve — USDC that cannot be delegated downstream. It is only released when you approve or cancel the root.' },
  { q: 'What happens when a child commitment fails?', a: "Unspent USDC returns to the parent's remaining balance and delegation capacity is restored. Successfully settled grandchildren keep their USDC — only the immediate commitment's unspent balance is refunded." },
  { q: 'Is the contract immutable? Are there admin keys?', a: 'Yes, immutable. Cascade has no admin keys, no proxy pattern, no protocol fees, no governance, and no upgrade path. What you read in the source is exactly what runs on-chain.' },
  { q: 'How deep can the commitment tree be?', a: 'Up to 8 levels deep (root is depth 0). Each node can have up to 16 direct children. Deeper allocation uses funds already within the delegation mandate — no double-counting of root exposure.' },
  { q: 'Who can expire a commitment?', a: "Anyone. Once a commitment's deadline has passed and all its children are terminal, any address may call expire. The unspent balance returns to the parent." },
  { q: 'How are USDC withdrawals handled?', a: 'Pull-based only. Approved work credits a claimable balance. The recipient calls claim at any time to pull their USDC. There are no automatic pushes and no admin withdrawals.' },
]

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <details open={open} style={{ borderTop: '1px solid var(--line)' }} onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary style={{
        listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 0', cursor: 'pointer', gap: 16,
      }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 650, color: 'var(--ink)' }}>{q}</span>
        <Plus size={16} style={{ color: 'var(--muted)', flexShrink: 0, transform: open ? 'rotate(45deg)' : 'rotate(0)', transition: 'transform 250ms var(--ease)' }} />
      </summary>
      <p style={{ fontSize: '0.875rem', color: 'var(--muted)', lineHeight: 1.7, paddingBottom: 20, maxWidth: '65ch' }}>{a}</p>
    </details>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   HERO CHECK ICON
══════════════════════════════════════════════════════════════════════════════ */
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M2.5 7L5.5 10L11.5 4" stroke="#6D8662" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
const TRUST = ['Bounded delegation', 'USDC settlement', 'Accountable outcomes']

// Footer is now the shared SiteFooter component (src/components/SiteFooter.tsx)

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN LANDING
══════════════════════════════════════════════════════════════════════════════ */
export function Landing({ onNavigate }: Props) {
  return (
    <div className="landing" style={{ paddingBottom: 0 }}>

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="hero-section" style={{ paddingLeft: 36, paddingRight: 36, textAlign: 'center' }}>
        <div style={{ maxWidth: C, margin: '0 auto' }}>
          <p className="hero-eyebrow" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: 26, animationDelay: '0ms', display: 'block' }}>
            Financial authority, made clear
          </p>
          <h1 className="hero-headline" style={{ maxWidth: 1090, margin: '0 auto', animationDelay: '60ms' }}>
            <span style={{ color: 'var(--ink)' }}>One outcome.</span>
            <br />
            <span style={{ color: '#73796F', display: 'block', textWrap: 'balance' }}>
              Every contribution
              <br className="headline-br-2" />
              {' '}accounted for.
            </span>
          </h1>
          <p className="hero-desc" style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--secondary)', maxWidth: 535, margin: '25px auto 0', animationDelay: '120ms' }}>
            Fund an objective. Delegate within a clear limit. See where every USDC
            goes, from the first commitment to the final settlement.
          </p>
          <div className="hero-ctas" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 28, animationDelay: '180ms' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('explore')} style={{ gap: 7 }}>
              Explore the workspace <Arrow />
            </button>
            <button className="btn" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} style={{ gap: 6 }}>
              See how it works <ChevSmall />
            </button>
          </div>
          <div className="hero-trust" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 23, flexWrap: 'wrap', animationDelay: '240ms' }}>
            {TRUST.map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--muted)' }}>
                <CheckIcon />{t}
              </span>
            ))}
          </div>
          {/* Showcase */}
          <div className="hero-diagram" style={{ animationDelay: '300ms' }}>
            <Showcase />
          </div>
        </div>
      </section>

      {/* ── PROOF STRIP ──────────────────────────────────────────────────────── */}
      <Reveal>
        <section style={{ background: 'var(--white)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', padding: '90px 0' }} className="proof-mobile-pad">
          <Wrap>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }} className="proof-grid">
              {PROOF.map((p, i) => (
                <div key={p.title} style={{ padding: '0 40px', borderLeft: i > 0 ? '1px solid var(--line)' : 'none' }}>
                  <h3 style={{ fontSize: 'clamp(1.375rem, 2.5vw, 1.625rem)', fontWeight: 650, letterSpacing: '-0.05em', color: 'var(--ink)', marginBottom: 10 }}>{p.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--secondary)', lineHeight: 1.65, maxWidth: '28ch' }}>{p.body}</p>
                </div>
              ))}
            </div>
          </Wrap>
        </section>
      </Reveal>

      {/* ── BOUNDARY / MANDATE ───────────────────────────────────────────────── */}
      <Reveal>
        <section id="the-protocol" style={{ padding: '110px 0' }} className="boundary-mobile-pad">
          <Wrap>
            <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 110, alignItems: 'start' }} className="boundary-grid">
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: 20 }}>
                  The core idea
                </p>
                <h2 style={{ fontSize: 'clamp(2.375rem, 4.3vw, 3.8125rem)', fontWeight: 650, letterSpacing: '-0.065em', lineHeight: 1.06, color: 'var(--ink)', marginBottom: 22, textWrap: 'balance' }}>
                  Give autonomy real boundaries.
                </h2>
                <p style={{ fontSize: '0.9375rem', color: 'var(--secondary)', lineHeight: 1.8, marginBottom: 28, maxWidth: '40ch' }}>
                  Delegation shouldn't mean losing control of the entire budget. Cascade keeps a protected amount at the root while specialists work with authorized funds.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {['Limits are defined before funds move.','Unspent failed allocations return.','Completed payouts stay final.'].map(t => (
                    <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Check22 />
                      <span style={{ fontSize: '0.875rem', color: 'var(--ink-2)' }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <MandateCard />
            </div>
          </Wrap>
        </section>
      </Reveal>

      {/* ── DARK PROCESS ─────────────────────────────────────────────────────── */}
      <Reveal>
        <section id="how-it-works" style={{ background: '#1B1F1A', padding: '105px 0' }}>
          <Wrap>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 64, gap: 40, flexWrap: 'wrap' }} className="process-head">
              <div style={{ flex: '0 0 auto', maxWidth: 560 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: '#B4BAAB', marginBottom: 18 }}>
                  Simple process. Serious infrastructure.
                </p>
                <h2 className="process-h2" style={{ fontSize: 'clamp(2.0625rem, 4vw, 3.375rem)', fontWeight: 650, letterSpacing: '-0.058em', lineHeight: 1.08, color: '#fff', textWrap: 'balance' }}>
                  From an intention<br />to a settled outcome.
                </h2>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#AEB5AA', lineHeight: 1.7, maxWidth: 340, paddingTop: 8 }}>
                Everyone knows their responsibility. Every allocation has a boundary. Each payment has a clear reason.
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', paddingTop: 40 }} className="process-grid">
              {PROCESS.map((p, i) => (
                <div key={p.n} style={{ padding: i === 0 ? '40px 32px 40px 0' : '40px 32px', borderLeft: i > 0 ? '1px solid #3A3F36' : 'none' }}>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: '#AEB5AA', marginBottom: 14 }}>{p.n}</p>
                  <div style={{ width: 41, height: 41, background: '#31382D', border: '1px solid #42483D', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    {p.icon}
                  </div>
                  <h3 style={{ fontSize: '1.375rem', fontWeight: 600, color: '#fff', letterSpacing: '-0.04em', marginBottom: 10 }}>{p.title}</h3>
                  <p style={{ fontSize: '0.8125rem', color: '#AEB5AA', lineHeight: 1.7 }}>{p.body}</p>
                </div>
              ))}
            </div>
          </Wrap>
        </section>
      </Reveal>

      {/* ── WORKSPACE PREVIEW ────────────────────────────────────────────────── */}
      <Reveal>
        <section style={{ padding: '110px 0' }}>
          <Wrap>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'start', marginBottom: 56 }} className="preview-head-grid">
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: 18 }}>
                  Designed for clarity
                </p>
                <h2 style={{ fontSize: 'clamp(2.0625rem, 4vw, 3.375rem)', fontWeight: 650, letterSpacing: '-0.058em', lineHeight: 1.08, color: 'var(--ink)', textWrap: 'balance' }}>
                  Your entire operation. One clear view.
                </h2>
              </div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--secondary)', lineHeight: 1.7, paddingTop: 8, maxWidth: '38ch' }}>
                See every objective, follow its branches, and understand who can act next — without deciphering raw contract data.
              </p>
            </div>
            <WorkspacePreview onNavigate={onNavigate} />
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button className="btn btn-primary" onClick={() => onNavigate('explore')} style={{ gap: 7 }}>
                See the full workspace <Arrow />
              </button>
            </div>
          </Wrap>
        </section>
      </Reveal>

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      <Reveal>
        <section style={{ padding: '0 0 110px' }}>
          <Wrap>
            <div style={{ display: 'grid', gridTemplateColumns: '.72fr 1.28fr', gap: 110, alignItems: 'start' }} className="faq-grid">
              <div style={{ position: 'sticky', top: 100 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: 'var(--secondary)', marginBottom: 16 }}>
                  The details matter
                </p>
                <h2 style={{ fontSize: 'clamp(2.0625rem, 3.5vw, 2.875rem)', fontWeight: 650, letterSpacing: '-0.065em', lineHeight: 1.06, color: 'var(--ink)', textWrap: 'balance' }}>
                  Questions, answered.
                </h2>
              </div>
              <div>
                {FAQ_ITEMS.map(item => <FaqRow key={item.q} {...item} />)}
                <div style={{ borderTop: '1px solid var(--line)' }} />
              </div>
            </div>
          </Wrap>
        </section>
      </Reveal>

      {/* ── FINAL CTA ────────────────────────────────────────────────────────── */}
      <Reveal>
        <section style={{ background: 'var(--lime)', padding: '87px 0', textAlign: 'center' }}>
          <Wrap>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.145em', textTransform: 'uppercase', color: '#4B5E31', marginBottom: 22 }}>
              Build with clearer authority
            </p>
            <h2 style={{ fontSize: 'clamp(2.4375rem, 5.5vw, 4.5625rem)', fontWeight: 650, letterSpacing: '-0.07em', lineHeight: 1.04, color: 'var(--ink)', marginBottom: 20, textWrap: 'balance' }}>
              Make every dollar<br />accountable to the outcome.
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#4F5A3B', lineHeight: 1.6, marginBottom: 32 }}>
              One mandate. A transparent work tree. Independent settlement.
            </p>
            <button className="btn btn-primary" onClick={() => onNavigate('explore')} style={{ gap: 7, height: 52, padding: '0 28px', fontSize: '0.9375rem' }}>
              Explore Cascade <Arrow size={14} />
            </button>
          </Wrap>
        </section>
      </Reveal>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <SiteFooter onNavigate={onNavigate} />
    </div>
  )
}
