/**
 * Skeleton — animated placeholder for loading states.
 */
import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?:     number | string
  height?:    number | string
  radius?:    number | string
  className?: string
  style?:     CSSProperties
}

export function Skeleton({ width = '100%', height = 16, radius = 6, className = '', style }: SkeletonProps) {
  return (
    <span
      role="presentation"
      aria-hidden
      className={`animate-pulse ${className}`}
      style={{
        display:      'inline-block',
        width:        typeof width  === 'number' ? `${width}px`  : width,
        height:       typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
        background:   '#E8EAE4',
        flexShrink:   0,
        ...style,
      }}
    />
  )
}

/** A row of Skeleton spans for table-like content. */
export function SkeletonRow({ cols = 4, height = 14 }: { cols?: number; height?: number }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {Array.from({ length: cols }, (_, i) => (
        <Skeleton key={i} height={height} width={i === 0 ? '30%' : '15%'} />
      ))}
    </div>
  )
}
