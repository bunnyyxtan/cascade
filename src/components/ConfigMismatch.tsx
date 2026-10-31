/**
 * ConfigMismatch — full-screen panel for 'mismatch' and 'not-deployed'.
 * Uses tokens and ui/ primitives only. No inline font-size.
 */
import { AlertCircle } from 'lucide-react'
import { NETWORK_LABEL } from '@/lib/network'
import { CASCADE_ADDRESS, addrUrl } from '@/lib/contracts'
import type { ConfigCheckResult } from '@/lib/configCheck'

export function ConfigMismatch({ result }: { result: ConfigCheckResult }) {
  const isNotDeployed = result.status === 'not-deployed'

  return (
    <div className="cfg-mismatch-wrap">
      <div className="cfg-mismatch-card" role="alert">

        {/* Icon + heading */}
        <div className="cfg-mismatch-head">
          <AlertCircle size={20} className="cfg-mismatch-icon" aria-hidden />
          <p className="cfg-mismatch-title">
            {isNotDeployed ? 'Contract not found' : 'Configuration mismatch'}
          </p>
        </div>

        {/* Body */}
        <p className="cfg-mismatch-body">
          {isNotDeployed
            ? `No Cascade contract was found at the configured address on ${NETWORK_LABEL}.`
            : `The contract at the configured address does not match the expected configuration for ${NETWORK_LABEL}.`
          }
          {result.detail && <>{' '}{result.detail}</>}
        </p>

        {/* Expected / Actual diff */}
        {result.status === 'mismatch' && (result.expected || result.actual) && (
          <div className="cfg-mismatch-diff">
            {result.expected && <div className="cfg-mismatch-expected">Expected: {result.expected}</div>}
            {result.actual   && <div className="cfg-mismatch-actual">Actual:   {result.actual}</div>}
          </div>
        )}

        {/* Fix instructions */}
        <div className="cfg-mismatch-help">
          <p>
            To fix this, update{' '}
            <code className="cfg-code">VITE_CASCADE_ADDRESS</code>,{' '}
            <code className="cfg-code">VITE_CASCADE_CODEHASH</code> and{' '}
            <code className="cfg-code">VITE_NETWORK</code>{' '}
            in your <code className="cfg-code">.env</code> file.
          </p>
          {CASCADE_ADDRESS && (
            <p className="cfg-mismatch-addr">
              Configured address:{' '}
              <a
                href={addrUrl(CASCADE_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className="cfg-mismatch-link"
              >
                {CASCADE_ADDRESS}
              </a>
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
