/**
 * Stat — a label + Amount pair, used in summary strips and dashboards.
 */
import type { CSSProperties } from 'react'
import { Amount, type AmountSize, type AmountSign } from './Amount'

interface StatProps {
  label:     string
  value:     string
  size?:     AmountSize
  sign?:     AmountSign
  className?: string
  style?:    CSSProperties
}

export function Stat({ label, value, size = 'md', sign = 'none', className = '', style }: StatProps) {
  return (
    <div className={`stat ${className}`} style={style}>
      <p className="stat-label">{label}</p>
      <Amount value={value} size={size} sign={sign} />
    </div>
  )
}
