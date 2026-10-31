/**
 * ReadError — shown when a contract read fails.
 * Never falls back to zeros or blank rows.
 */
import { RefreshCw } from 'lucide-react'
import { NETWORK_LABEL } from '@/lib/network'

interface Props {
  message?: string
  onRetry?: () => void
}

export function ReadError({ message, onRetry }: Props) {
  return (
    <div role="alert" className="read-error">
      <p className="read-error-title">Couldn't load from {NETWORK_LABEL}</p>
      {message && <p className="read-error-msg">{message}</p>}
      {onRetry && (
        <button onClick={onRetry} className="read-error-retry">
          <RefreshCw size={13} aria-hidden />
          Retry
        </button>
      )}
    </div>
  )
}
