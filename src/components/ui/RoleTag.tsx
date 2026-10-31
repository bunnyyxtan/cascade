/**
 * RoleTag — thin compatibility wrapper around Pill.
 * New code should use <Pill tone="neutral"> directly.
 */
import type { CSSProperties } from 'react'
import { Pill } from './Pill'

interface RoleTagProps {
  role:       string
  className?: string
  style?:     CSSProperties
}

export function RoleTag({ role, className = '', style }: RoleTagProps) {
  const label = role.charAt(0).toUpperCase() + role.slice(1)
  return (
    <Pill tone="neutral" size="sm" className={className} style={style}>
      {label}
    </Pill>
  )
}
