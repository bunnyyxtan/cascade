/**
 * Pill — unified pill/chip/badge primitive.
 *
 * Replaces: StatusBadge inline styles, RoleTag rainbow colours,
 *           filter chips, the topbar network chip, and "You" tags.
 *
 * Sizes:
 *   sm  — height 24px, 12px text, padding 0 10px  (display / inline badges)
 *   md  — height 28px, 13px text, padding 0 12px  (interactive filter chips)
 *
 * Tones:
 *   neutral   — white bg, var(--line) border, var(--text-2) text
 *   accent    — lime tint bg, darker lime border, ink text
 *   active / submitted / settled / rejected / cancelled / expired
 *             — status colours matching STATUS_MAP
 *
 * Interactive (as="button"):
 *   selected  — ink border + check icon
 *   focus-visible ring
 */
import { Check } from 'lucide-react'
import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from 'react'
import type { StatusKind } from '@/lib/status'

export type PillTone = 'neutral' | 'accent' | StatusKind
export type PillSize = 'sm' | 'md'

// ── Tone → visual tokens ────────────────────────────────────────────────────

interface ToneTokens { bg: string; border: string; fg: string; dot: string }

const TONE_TOKENS: Record<PillTone, ToneTokens> = {
  neutral:   { bg: 'var(--white)',  border: 'var(--line)',      fg: 'var(--text-2)', dot: 'var(--muted)' },
  accent:    { bg: '#EDFACC',       border: '#BDDF78',          fg: 'var(--ink)',    dot: '#8DB82C' },
  active:    { bg: '#F3FBD9',       border: '#C0DA6E',          fg: '#151714',       dot: '#8DB82C' },
  submitted: { bg: '#FDF3DF',       border: '#E0C479',          fg: '#7A5A12',       dot: '#C49226' },
  settled:   { bg: '#E6F3EA',       border: '#96CCB0',          fg: '#1F6B43',       dot: '#2E9A5E' },
  rejected:  { bg: '#FBE9E8',       border: '#E6A09D',          fg: '#A63D3A',       dot: '#C75450' },
  cancelled: { bg: '#EEF0EC',       border: '#BEC4B9',          fg: '#4A5245',       dot: '#8A9285' },
  expired:   { bg: '#F4EDE4',       border: '#D9B990',          fg: '#7A5534',       dot: '#B07A4A' },
}

// ── Size → layout tokens ────────────────────────────────────────────────────

const SIZE_STYLES: Record<PillSize, { height: number; fontSize: string; padding: string; gap: number }> = {
  sm: { height: 24, fontSize: '0.75rem',    padding: '0 10px', gap: 5 },
  md: { height: 28, fontSize: '0.8125rem',  padding: '0 12px', gap: 6 },
}

// ── Props ───────────────────────────────────────────────────────────────────

type PillSpanProps = {
  as?: 'span'
  selected?: never
  onClick?: never
  role?: string
  'aria-label'?: string
  'aria-checked'?: never
}
type PillButtonProps = {
  as: 'button'
  selected?: boolean
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  role?: string
  'aria-checked'?: boolean | 'true' | 'false'
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'role'>

type PillProps = (PillSpanProps | PillButtonProps) & {
  tone?:      PillTone
  size?:      PillSize
  dot?:       boolean
  dotColor?:  string
  children:   ReactNode
  className?: string
  style?:     CSSProperties
}

// ── Component ────────────────────────────────────────────────────────────────

export function Pill({
  tone = 'neutral',
  size = 'sm',
  dot = false,
  dotColor,
  children,
  className = '',
  style,
  as,
  selected,
  ...rest
}: PillProps) {
  const tokens = TONE_TOKENS[tone]
  const sz     = SIZE_STYLES[size]

  const baseStyle: CSSProperties = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    width:          'fit-content',
    justifySelf:    'start',
    alignSelf:      'center',
    height:         sz.height,
    padding:        sz.padding,
    gap:            sz.gap,
    fontSize:       sz.fontSize,
    fontWeight:     600,
    lineHeight:     1,
    whiteSpace:     'nowrap',
    borderRadius:   999,
    background:     tokens.bg,
    color:          selected ? 'var(--ink)' : tokens.fg,
    border:         `1px solid ${selected ? 'var(--ink)' : tokens.border}`,
    cursor:         as === 'button' ? 'pointer' : undefined,
    // reset button defaults
    fontFamily:     'var(--font-sans)',
    textDecoration: 'none',
    outline:        'none',
    flexShrink:     0,
    ...style,
  }

  const dotEl = dot ? (
    <span
      aria-hidden
      style={{
        width:        6,
        height:       6,
        borderRadius: '50%',
        background:   dotColor ?? tokens.dot,
        flexShrink:   0,
        display:      'inline-block',
      }}
    />
  ) : null

  const checkEl = selected ? (
    <Check size={10} aria-hidden style={{ flexShrink: 0 }} />
  ) : null

  if (as === 'button') {
    const { as: _as, selected: _sel, ...btnRest } = rest as PillButtonProps & { as: 'button'; selected?: boolean }
    return (
      <button
        type="button"
        className={`pill pill--${tone} pill--${size}${selected ? ' pill--selected' : ''} ${className}`}
        style={baseStyle}
        {...btnRest}
      >
        {checkEl}
        {dotEl}
        {children}
      </button>
    )
  }

  // span — pass through role/aria-label from rest (PillSpanProps)
  const { as: _as, selected: _sel, ...spanRest } = rest as PillSpanProps & { as?: 'span'; selected?: never }
  return (
    <span
      className={`pill pill--${tone} pill--${size} ${className}`}
      style={baseStyle}
      {...spanRest}
    >
      {dotEl}
      {children}
    </span>
  )
}
