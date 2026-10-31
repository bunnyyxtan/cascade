/**
 * Amount — USDC amount display.
 * Sizes: sm (20px), md (28px), lg (40px), xl (56px).
 * Sign variants: released "+", returned/refunded "↩", held (none).
 * "Released" gets a settled-green sign only when sign === 'released'.
 * Money is never coloured green for any other variant.
 */
import type { CSSProperties } from 'react'

export type AmountSize = 'sm' | 'md' | 'lg' | 'xl'
export type AmountSign = 'released' | 'returned' | 'refunded' | 'held' | 'none'

interface AmountProps {
  /** Value already formatted as a decimal string, e.g. "12.50" */
  value:    string
  size?:    AmountSize
  sign?:    AmountSign
  className?: string
  style?:   CSSProperties
}

const SIZE_PX: Record<AmountSize, number> = {
  sm: 20,
  md: 28,
  lg: 40,
  xl: 56,
}

export function Amount({ value, size = 'md', sign = 'none', className = '', style }: AmountProps) {
  const px = SIZE_PX[size]
  const unitPx = Math.round(px * 0.7)

  const prefix =
    sign === 'released'              ? '+'  :
    sign === 'returned' || sign === 'refunded' ? '↩ ' :
    ''

  const prefixColor = sign === 'released' ? '#1F6B43' : 'var(--text-3)'

  return (
    <span
      className={className}
      style={{
        display:            'inline-flex',
        alignItems:         'baseline',
        gap:                '0.2em',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing:      '-0.02em',
        lineHeight:         1,
        ...style,
      }}
    >
      {prefix && (
        <span style={{ fontSize: Math.max(12, px * 0.65), color: prefixColor, fontWeight: 600, letterSpacing: 0 }}>
          {prefix}
        </span>
      )}
      <span style={{ fontSize: px, fontWeight: 650, color: 'var(--ink)' }}>
        {value}
      </span>
      <span style={{ fontSize: Math.max(12, unitPx), fontWeight: 450, color: 'var(--text-3)' }}>
        USDC
      </span>
    </span>
  )
}
