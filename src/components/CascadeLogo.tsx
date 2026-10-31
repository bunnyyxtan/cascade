/**
 * CascadeLogo — single source of truth for the Cascade brand mark.
 *
 * The approved brand mark is a five-node organic branching tree with a
 * lime-green root circle. It is reconstructed as a clean inline SVG.
 *
 * Props:
 *   size     — rendered height in px (width scales to preserve aspect ratio)
 *   variant  — 'default' (dark on transparent) | 'white' (white on transparent)
 *              | 'favicon' (simplified + dark bg square, for icon contexts)
 *   withText — when true, renders the "cascade." wordmark next to the mark
 *   className / style — forwarded to the root element
 *
 * Usage:
 *   <CascadeLogo size={32} />
 *   <CascadeLogo size={28} withText />
 *   <CascadeLogo size={32} variant="white" withText />   ← footer (dark bg)
 *   <CascadeLogo size={22} withText />                   ← sidebar mock
 */

import type { CSSProperties } from 'react'

// Aspect ratio of the mark viewBox: 200 wide × 250 tall
const ASPECT = 200 / 250

type Variant = 'default' | 'white' | 'favicon'

interface CascadeLogoProps {
  size?:      number
  variant?:   Variant
  withText?:  boolean
  className?: string
  style?:     CSSProperties
}

// ── The full-detail mark (all 5 nodes + root lime) ──────────────────────────

function FullMark({ size, branch, node, lime }: {
  size:   number
  branch: string
  node:   string
  lime:   string
}) {
  const w = Math.round(size * ASPECT)
  const h = size

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 200 250"
      fill="none"
      aria-hidden
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Branch strokes */}
      <g stroke={branch} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Main trunk: root → outer-branch split */}
        <line x1="100" y1="194" x2="100" y2="164" strokeWidth="15"/>
        {/* Trunk: outer split → inner split */}
        <line x1="100" y1="164" x2="100" y2="110" strokeWidth="14"/>
        {/* Trunk: inner split → top node area */}
        <path strokeWidth="13" d="M 100 110 L 100 38"/>
        {/* Inner-left branch */}
        <path strokeWidth="12"
          d="M 100 118 C 88 110, 72 88, 60 66 C 56 56, 54 52, 54 50"/>
        {/* Inner-right branch */}
        <path strokeWidth="12"
          d="M 100 108 C 112 100, 128 80, 138 62 C 144 52, 146 48, 146 44"/>
        {/* Outer-left branch */}
        <path strokeWidth="13"
          d="M 98 168 C 82 164, 58 150, 36 132 C 22 120, 14 112, 14 112"/>
        {/* Outer-right branch */}
        <path strokeWidth="13"
          d="M 102 168 C 118 164, 142 150, 164 132 C 178 120, 186 112, 186 112"/>
      </g>

      {/* Terminal node circles */}
      <g fill={node}>
        <circle cx="100" cy="22"  r="22"/>  {/* center-top  */}
        <circle cx="54"  cy="52"  r="20"/>  {/* inner-left  */}
        <circle cx="146" cy="46"  r="20"/>  {/* inner-right */}
        <circle cx="14"  cy="112" r="20"/>  {/* outer-left  */}
        <circle cx="186" cy="112" r="20"/>  {/* outer-right */}
        {/* Root outer ring */}
        <circle cx="100" cy="216" r="24"/>
      </g>

      {/* Root lime fill */}
      <circle cx="100" cy="216" r="15" fill={lime}/>
    </svg>
  )
}

// ── Favicon/icon mark: simplified for small sizes ──────────────────────────

function FaviconMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      style={{ display: 'block', flexShrink: 0 }}
    >
      <rect width="32" height="32" rx="7" fill="#1A1D18"/>
      <g stroke="#F8F8F5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1="16" y1="28" x2="16" y2="10" strokeWidth="2.4"/>
        <path strokeWidth="2" d="M 16 19 C 12 17, 9 14, 8 10"/>
        <path strokeWidth="2" d="M 16 17 C 20 15, 22 12, 24 9"/>
      </g>
      <circle cx="16"   cy="7.5" r="3.5" fill="#F8F8F5"/>
      <circle cx="7.5"  cy="8.5" r="3"   fill="#F8F8F5"/>
      <circle cx="24.5" cy="7.5" r="3"   fill="#F8F8F5"/>
      <circle cx="16"   cy="29"  r="4"   fill="#1A1D18" stroke="#F8F8F5" strokeWidth="1.5"/>
      <circle cx="16"   cy="29"  r="2.2" fill="#72F53A"/>
    </svg>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export function CascadeLogo({
  size      = 32,
  variant   = 'default',
  withText  = false,
  className,
  style,
}: CascadeLogoProps) {
  const isDark   = variant === 'white'
  const branch   = isDark ? '#FFFFFF' : '#1A1D18'
  const node     = isDark ? '#FFFFFF' : '#1A1D18'
  const lime     = '#72F53A'

  // Text size tracks mark size
  const textSize = Math.max(12, Math.round(size * 0.625))
  const textColor = isDark ? '#F4F5F1' : 'var(--ink)'
  const dotColor  = isDark ? '#A1CE48' : '#A1CE48'

  const mark = variant === 'favicon'
    ? <FaviconMark size={size} />
    : <FullMark size={size} branch={branch} node={node} lime={lime} />

  if (!withText) {
    return (
      <span
        className={className}
        style={{ display: 'inline-flex', alignItems: 'center', ...style }}
      >
        {mark}
      </span>
    )
  }

  return (
    <span
      className={className}
      style={{
        display:     'inline-flex',
        alignItems:  'center',
        gap:         Math.round(size * 0.28),
        ...style,
      }}
    >
      {mark}
      <span style={{
        fontSize:      textSize,
        fontWeight:    650,
        letterSpacing: '-0.04em',
        color:         textColor,
        fontFamily:    'var(--font-sans)',
        lineHeight:    1,
        userSelect:    'none',
      }}>
        cascade<span style={{ color: dotColor }}>.</span>
      </span>
    </span>
  )
}

export default CascadeLogo
