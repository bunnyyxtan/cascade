/**
 * KeyValue — a definition list with a fixed label column (left) and
 * right-aligned values. Label: text-sm/600/text-2. Value: text-md/ink.
 */
import type { ReactNode } from 'react'

export interface KVItem {
  label: string | ReactNode
  value: ReactNode
}

interface KeyValueProps {
  items:      KVItem[]
  className?: string
  labelWidth?: number | string
}

export function KeyValue({ items, className = '', labelWidth = 120 }: KeyValueProps) {
  return (
    <dl className={`kv-list ${className}`}>
      {items.map((item, i) => (
        <div key={i} className="kv-row">
          <dt className="kv-label" style={{ width: typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth }}>
            {item.label}
          </dt>
          <dd className="kv-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
