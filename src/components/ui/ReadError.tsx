/**
 * ReadError — shown when a contract read or history sync fails.
 * Never falls back to zeros or blank rows.
 *
 * Mobile-first: concise primary message, functional Retry button,
 * technical details hidden behind an expandable "Show details" toggle.
 */
import { useState } from 'react'
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { NETWORK_LABEL } from '@/lib/network'

interface Props {
  message?: string
  onRetry?: () => void
}

export function ReadError({ message, onRetry }: Props) {
  const [expanded, setExpanded] = useState(false)

  // Detect if the message looks like raw technical data (long JSON, URLs, RPC bodies)
  const isTechnical = !!message && (
    message.length > 120 ||
    message.includes('{') ||
    message.includes('http') ||
    message.includes('0x') ||
    message.includes('eth_')
  )

  const summary = isTechnical
    ? `Activity is temporarily unavailable. ${NETWORK_LABEL} is busy.`
    : (message ?? `Could not load from ${NETWORK_LABEL}.`)

  const details = isTechnical ? message : undefined

  return (
    <div role="alert" className="read-error">
      <p className="read-error-title">{summary}</p>

      {details && (
        <div className="read-error-details-wrap">
          <button
            className="read-error-details-toggle"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>
          {expanded && (
            <pre className="read-error-details">{details}</pre>
          )}
        </div>
      )}

      {onRetry && (
        <button onClick={onRetry} className="read-error-retry">
          <RefreshCw size={13} aria-hidden />
          Retry
        </button>
      )}
    </div>
  )
}
