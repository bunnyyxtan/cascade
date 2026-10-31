/**
 * Notice — info / warn / error / success banner with icon, title, body.
 */
import type { ReactNode, CSSProperties } from 'react'
import { Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react'

export type NoticeKind = 'info' | 'warn' | 'error' | 'success'

const NOTICE_STYLES: Record<NoticeKind, { bg: string; border: string; fg: string; icon: typeof Info }> = {
  info:    { bg: '#F0F4FB', border: '#C5D6F0', fg: '#1E407A', icon: Info },
  warn:    { bg: '#FDF3DF', border: '#F0DDB0', fg: '#7A5A12', icon: AlertTriangle },
  error:   { bg: '#FBE9E8', border: '#F0C2C1', fg: '#A63D3A', icon: XCircle },
  success: { bg: '#E6F3EA', border: '#A8D9B8', fg: '#1F6B43', icon: CheckCircle2 },
}

interface NoticeProps {
  kind:      NoticeKind
  title?:    string
  children:  ReactNode
  className?: string
  style?:    CSSProperties
}

export function Notice({ kind, title, children, className = '', style }: NoticeProps) {
  const s   = NOTICE_STYLES[kind]
  const Icon = s.icon
  return (
    <div
      className={`notice notice--${kind} ${className}`}
      role={kind === 'error' ? 'alert' : 'note'}
      style={{ background: s.bg, border: `1px solid ${s.border}`, ...style }}
    >
      <Icon size={16} className="notice-icon" style={{ color: s.fg }} aria-hidden />
      <div className="notice-body">
        {title && <p className="notice-title" style={{ color: s.fg }}>{title}</p>}
        <div className="notice-content" style={{ color: s.fg }}>{children}</div>
      </div>
    </div>
  )
}
