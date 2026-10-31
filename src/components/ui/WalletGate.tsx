/**
 * WalletGate — replaces action areas when disconnected, on wrong network,
 * or when the contract verification check has not passed.
 *
 * Layer order (outermost first):
 *   1. Not connected    → Connect wallet prompt
 *   2. Wrong chain      → Switch chain prompt
 *   3. Contract check   → loading spinner | error/retry | unverified note
 *   4. Children         → write UI (submit, approve, create, claim…)
 *
 * No inline font-size. All sizes from CSS classes.
 */
import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, Wallet, ArrowUpRight } from 'lucide-react'
import { TARGET_CHAIN_ID } from '@/lib/contracts'
import { NETWORK_LABEL, SWITCH_TO_LABEL } from '@/lib/network'
import { useConfigCheck, retryConfigCheck, useChainIdWatcher, EXPECTED_CONFIG_KEY } from '@/lib/configCheck'

interface WalletGateProps {
  /** Content shown when wallet is connected on the right chain and contract is verified */
  children: React.ReactNode
  isConnected: boolean
  isWrongChain: boolean
}

export function WalletGate({ children, isConnected, isWrongChain }: WalletGateProps) {
  // Layer 1 — not connected
  if (!isConnected) {
    return (
      <GateNote
        variant="info"
        icon={<Wallet size={14} aria-hidden />}
        message="Connect a wallet to continue."
        action={
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button className="btn btn-sm gate-note-btn" onClick={show}>
                Connect wallet
              </button>
            )}
          </ConnectKitButton.Custom>
        }
      />
    )
  }

  // Layer 2 — wrong chain
  if (isWrongChain) {
    return <WrongChainNote />
  }

  // Layer 3 — contract verification
  return <ContractVerifiedGate>{children}</ContractVerifiedGate>
}

/** Small doc link shown inside gate notes. */
function GateLearnMore({ href }: { href: string }) {
  return (
    <a href={href} className="learn-more-link gate-learn-more">
      Learn more <ArrowUpRight size={11} aria-hidden />
    </a>
  )
}

/** Inner gate: blocks writes until contract verification passes. */
function ContractVerifiedGate({ children }: { children: React.ReactNode }) {
  const result = useConfigCheck()
  const { chainId } = useAccount()
  // Re-run check when wallet switches to the target chain
  useChainIdWatcher(chainId)
  const isCurrentKey = result.key === EXPECTED_CONFIG_KEY

  // Only allow writes when status is 'ok' AND the config key matches
  if (result.status === 'ok' && isCurrentKey) {
    return <>{children}</>
  }

  // Error / unverified / mismatch / not-deployed — show retry note
  if (
    result.status === 'error' ||
    result.status === 'unverified' ||
    result.status === 'mismatch' ||
    result.status === 'not-deployed'
  ) {
    return (
      <GateNote
        variant="warn"
        icon={<AlertCircle size={14} aria-hidden />}
        message={`Couldn't verify the Cascade contract on ${NETWORK_LABEL}. Financial actions are disabled until verification succeeds.`}
        action={
          <button
            className="btn btn-sm gate-note-btn"
            onClick={retryConfigCheck}
            aria-label="Retry contract verification"
          >
            <RefreshCw size={11} aria-hidden /> Retry
          </button>
        }
        detail={result.detail}
        learnMore={<GateLearnMore href="/docs/troubleshooting" />}
      />
    )
  }

  // Loading / stale key — show verifying spinner
  return (
    <GateNote
      variant="info"
      icon={<Loader2 size={13} className="gate-spinner" aria-hidden />}
      message={`Verifying the Cascade contract on ${NETWORK_LABEL}…`}
      action={
        <span className="gate-note-checking" aria-live="polite">
          <Loader2 size={13} className="gate-spinner" aria-hidden />
          Checking…
        </span>
      }
    />
  )
}

export function WrongChainNote() {
  const { switchChain, isPending } = useSwitchChain()
  const [switchErr, setSwitchErr] = useState<string | null>(null)

  function doSwitch() {
    setSwitchErr(null)
    switchChain({ chainId: TARGET_CHAIN_ID }, {
      onError: (e) => setSwitchErr(e.message?.split('\n')[0] ?? 'Switch failed'),
    })
  }

  return (
    <GateNote
      variant="warn"
      icon={<AlertCircle size={14} aria-hidden />}
      message={`${SWITCH_TO_LABEL} to continue.`}
      action={
        <button
          className="btn btn-sm btn-primary gate-note-btn"
          onClick={doSwitch}
          disabled={isPending}
          aria-busy={isPending}
        >
          {isPending
            ? <><Loader2 size={12} className="gate-spinner" aria-hidden />Switching…</>
            : SWITCH_TO_LABEL}
        </button>
      }
      error={switchErr}
      learnMore={<GateLearnMore href="/docs/troubleshooting" />}
    />
  )
}

function GateNote({
  variant, icon, message, action, error, detail, learnMore,
}: {
  variant: 'info' | 'warn'
  icon?: React.ReactNode
  message: string
  action: React.ReactNode
  error?: string | null
  detail?: string
  learnMore?: React.ReactNode
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`gate-note gate-note--${variant}`}
    >
      <div className="gate-note-header">
        {icon && <span className="gate-note-icon" aria-hidden>{icon}</span>}
        <p className="gate-note-msg">{message}</p>
      </div>
      <div className="gate-note-action">
        {action}
        {learnMore && <span className="gate-note-learn">{learnMore}</span>}
      </div>
      {error && <p className="gate-note-error">{error}</p>}
      {detail && <p className="gate-note-detail">{detail}</p>}
    </div>
  )
}
