/**
 * EmptyState — icon, 20px title, 16px body, one optional action.
 */
import type { ReactNode, CSSProperties } from 'react'

interface EmptyStateProps {
  icon:       ReactNode
  title:      string
  body?:      string
  action?:    ReactNode
  className?: string
  style?:     CSSProperties
}

export function EmptyState({ icon, title, body, action, className = '', style }: EmptyStateProps) {
  return (
    <div className={`empty-state ${className}`} style={style}>
      <div className="empty-state-icon">{icon}</div>
      <p className="empty-state-title">{title}</p>
      {body && <p className="empty-state-body">{body}</p>}
      {action}
    </div>
  )
}
