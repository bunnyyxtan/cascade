/**
 * Button — sm 36px / md 44px / lg 52px.
 * Variants: primary | secondary | ghost | danger-text | accent | danger | outline.
 * 3px #719B39 focus ring via global CSS.
 */
import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes, CSSProperties } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger-text' | 'accent' | 'danger' | 'outline'
export type ButtonSize    = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
  loading?: boolean
}

// Heights: sm 36, md 44, lg 52
const SIZE_H: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 }
const SIZE_PX: Record<ButtonSize, string> = {
  sm: '0.8125rem',  // 13px
  md: '0.9375rem',  // 15px
  lg: '1rem',       // 16px
}
const SIZE_PAD: Record<ButtonSize, string> = { sm: '0 14px', md: '0 20px', lg: '0 28px' }
const SIZE_R: Record<ButtonSize, string>   = { sm: '8px',    md: '10px',   lg: '12px'   }

const VARIANT_STYLE: Record<ButtonVariant, CSSProperties> = {
  primary:     { background: 'var(--ink)',     border: '1px solid var(--ink)',          color: '#fff' },
  secondary:   { background: 'var(--surface)', border: '1px solid var(--line-strong)',  color: 'var(--ink)' },
  ghost:       { background: 'transparent',    border: '1px solid var(--line)',         color: 'var(--text-2)' },
  'danger-text':{ background:'transparent',    border: 'none',                          color: 'var(--bad)' },
  accent:      { background: 'var(--lime)',     border: '1px solid var(--lime)',         color: 'var(--ink)' },
  danger:      { background: 'var(--bad)',      border: '1px solid var(--bad)',          color: '#fff' },
  outline:     { background: 'transparent',    border: '1px solid var(--line-strong)',  color: 'var(--ink)' },
}

export function Button({
  variant = 'primary',
  size    = 'md',
  loading,
  children,
  className = '',
  disabled,
  style,
  ...props
}: Props) {
  const h  = SIZE_H[size]
  const vs = VARIANT_STYLE[variant]

  const baseStyle: CSSProperties = {
    display:         'inline-flex',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             7,
    fontFamily:      'var(--font-sans)',
    fontWeight:      650,
    fontSize:        SIZE_PX[size],
    letterSpacing:   '-0.013em',
    lineHeight:      1,
    height:          h,
    padding:         SIZE_PAD[size],
    borderRadius:    SIZE_R[size],
    cursor:          (disabled && !loading) ? 'not-allowed' : 'pointer',
    opacity:         (disabled && !loading) ? 0.45 : 1,
    whiteSpace:      'nowrap',
    transition:      `background var(--dur-base) var(--ease), border-color var(--dur-base) var(--ease), color var(--dur-base) var(--ease)`,
    WebkitTapHighlightColor: 'transparent',
    ...vs,
    ...style,
  }

  return (
    <button
      className={className}
      style={baseStyle}
      disabled={disabled && !loading}
      aria-busy={loading || undefined}
      {...props}
      onClick={loading ? undefined : props.onClick}
    >
      {loading && <Loader2 size={size === 'sm' ? 13 : size === 'lg' ? 17 : 15} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
      {children}
    </button>
  )
}
