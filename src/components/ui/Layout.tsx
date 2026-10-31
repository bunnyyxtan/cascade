/**
 * Layout primitives: Container and PageHeader.
 * Shared by all app views.
 */
import type { ReactNode } from 'react'

/* ── Container ──────────────────────────────────────────────────────────────
   max-w 1200px; 1360px at ≥1536px.
   Padding: 32px ≥1024, 24px ≥640, 16px <640.
───────────────────────────────────────────────────────────────────────────── */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        maxWidth: 'var(--container-w, 1200px)',
        marginInline: 'auto',
        paddingInline: 'var(--container-px, 32px)',
      }}
    >
      {children}
    </div>
  )
}

/* ── PageHeader ─────────────────────────────────────────────────────────────
   kicker (DM Mono caps), title (text-2xl / text-3xl ≥1440), description,
   actions on the right. Stacks on mobile.
───────────────────────────────────────────────────────────────────────────── */
export interface PageHeaderProps {
  kicker?:      string
  title:        string
  description?: string
  action?:      ReactNode
  children?:    ReactNode
}

export function PageHeader({ kicker, title, description, action, children }: PageHeaderProps) {
  return (
    <>
      <div className="page-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {kicker && (
            <p className="page-header-kicker">{kicker}</p>
          )}
          <h1 className="page-h1">{title}</h1>
          {description && (
            <p className="page-header-desc">{description}</p>
          )}
        </div>
        {action && (
          <div className="page-header-action">{action}</div>
        )}
      </div>
      {children}
    </>
  )
}
