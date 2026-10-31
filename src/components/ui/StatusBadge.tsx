/**
 * StatusBadge — thin wrapper around Pill with status tone and dot.
 * Never stretches (width: fit-content via Pill).
 * Colour is never the only signal: the dot and label always accompany each other.
 */
import type { CSSProperties } from 'react'
import { type StatusStyle } from '@/lib/status'
import { Pill, type PillSize } from './Pill'

interface StatusBadgeProps {
  status:     StatusStyle
  size?:      PillSize
  className?: string
  style?:     CSSProperties
}

export function StatusBadge({ status, size = 'sm', className = '', style }: StatusBadgeProps) {
  return (
    <Pill
      tone={status.kind}
      size={size}
      dot
      dotColor={status.dot}
      className={className}
      style={style}
      role="status"
      aria-label={status.label}
    >
      {status.label}
    </Pill>
  )
}
