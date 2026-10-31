/**
 * Card — white surface with 1px border and 16px radius.
 * Section — a titled group inside a Card, separated by a 1px divider.
 */
import type { ReactNode, CSSProperties } from 'react'

interface CardProps {
  children:  ReactNode
  className?: string
  style?:    CSSProperties
  as?:       'div' | 'article' | 'section'
}

export function Card({ children, className = '', style, as: Tag = 'div' }: CardProps) {
  return (
    <Tag className={`card ${className}`} style={style}>
      {children}
    </Tag>
  )
}

interface SectionProps {
  title?:    string
  children:  ReactNode
  className?: string
  style?:    CSSProperties
}

export function Section({ title, children, className = '', style }: SectionProps) {
  return (
    <div className={`card-section ${className}`} style={style}>
      {title && <p className="card-section-title">{title}</p>}
      {children}
    </div>
  )
}
