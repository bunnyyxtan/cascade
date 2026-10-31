/**
 * TxStatus — transaction phase feedback.
 * Phases: pending → confirming → success → error.
 * User rejection (code 4001) → neutral note; real reverts → red.
 */
import { Check, ExternalLink, Loader2 } from 'lucide-react'
import { txUrl } from '@/lib/contracts'
import { parseOnchainError } from '@/lib/format'

function isUserRejection(err: unknown): boolean {
  let e: unknown = err
  while (e != null && typeof e === 'object') {
    const code = (e as { code?: unknown }).code
    const name = (e as { name?: unknown }).name
    if (code === 4001 || code === 'ACTION_REJECTED') return true
    if (typeof name === 'string' && (
      name === 'UserRejectedRequestError' || name === 'TransactionExecutionError'
    )) {
      const msg = ((e as { message?: string }).message ?? '').toLowerCase()
      if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected the request')) return true
    }
    e = (e as { cause?: unknown }).cause
  }
  return false
}

interface Props {
  isPending?: boolean
  isConfirming?: boolean
  isSuccess?: boolean
  isError?: boolean
  error?: unknown
  hash?: `0x${string}`
  successLabel?: string
  outcome?: string
  onDismiss?: () => void
}

export function TxStatus({
  isPending, isConfirming, isSuccess, isError,
  error, hash, successLabel = 'Confirmed', outcome, onDismiss,
}: Props) {
  if (!isPending && !isConfirming && !isSuccess && !isError) return null

  if (isPending) {
    return (
      <div role="status" aria-live="polite" className="tx-note tx-note--neutral">
        <Loader2 size={13} className="tx-spinner" aria-hidden />
        <span className="tx-msg">Waiting for signature…</span>
      </div>
    )
  }

  if (isConfirming) {
    return (
      <div role="status" aria-live="polite" className="tx-note tx-note--neutral">
        <Loader2 size={13} className="tx-spinner" aria-hidden />
        <span className="tx-msg">
          Submitted —{' '}
          {hash ? (
            <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="tx-link tx-link--ok">
              waiting for confirmation
              <ExternalLink size={10} className="tx-link-icon" aria-hidden />
            </a>
          ) : 'waiting for confirmation'}
        </span>
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div role="status" aria-live="polite" className="tx-note tx-note--ok">
        <Check size={13} className="tx-check" aria-hidden />
        <div className="tx-body">
          <span className="tx-confirmed">{successLabel}</span>
          {outcome && <p className="tx-outcome">{outcome}</p>}
          {hash && (
            <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="tx-explorer">
              View on explorer <ExternalLink size={9} aria-hidden />
            </a>
          )}
        </div>
      </div>
    )
  }

  if (isError) {
    const isRejected = isUserRejection(error)
    const msg = parseOnchainError(error)
    return (
      <div role="alert" className={`tx-note ${isRejected ? 'tx-note--neutral' : 'tx-note--err'}`}>
        <div className="tx-err-inner">
          <div className="tx-body">
            <p className={isRejected ? 'tx-msg' : 'tx-err-title'}>
              {isRejected ? 'Rejected in wallet' : 'Transaction failed.'}
            </p>
            <p className="tx-err-detail">
              {isRejected
                ? 'No transaction was sent. You can try again.'
                : <span className="mono">{msg}</span>}
            </p>
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="tx-dismiss">Dismiss</button>
          )}
        </div>
      </div>
    )
  }

  return null
}
