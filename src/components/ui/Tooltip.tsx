/**
 * Tooltip — keyboard-reachable, uses aria-describedby.
 * The trigger is a button; the tooltip has role="tooltip".
 * Closes on Escape and on blur.
 */
import { useState, useId, type ReactNode, type CSSProperties } from 'react'

interface TooltipProps {
  /** The element that triggers the tooltip (usually an icon). */
  trigger:    ReactNode
  /** Tooltip text content. */
  content:    ReactNode
  /** Accessible label for the trigger button. */
  label:      string
  className?: string
  style?:     CSSProperties
}

export function Tooltip({ trigger, content, label, className = '', style }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
    >
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setOpen(false)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
        style={{
          background: 'none',
          border:     'none',
          cursor:     'pointer',
          padding:    '2px',
          display:    'inline-flex',
          alignItems: 'center',
          color:      'var(--text-3)',
          borderRadius: 4,
          transition: 'color var(--dur-fast) var(--ease)',
        }}
      >
        {trigger}
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position:     'absolute',
            bottom:       'calc(100% + 6px)',
            left:         '50%',
            transform:    'translateX(-50%)',
            zIndex:       200,
            background:   'var(--dark)',
            color:        '#FFFFFF',
            fontWeight:   450,
            lineHeight:   1.5,
            padding:      '8px 12px',
            borderRadius: 'var(--r-sm)',
            maxWidth:     240,
            whiteSpace:   'normal',
            boxShadow:    'var(--shadow)',
            pointerEvents:'none',
          }}
        >
          {content}
        </span>
      )}
    </span>
  )
}
