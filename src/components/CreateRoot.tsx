/**
 * CreateRoot — D3 redesign.
 * Presentation only. All hooks, validation rules, approve/create call
 * paths, WalletGate and useSuccessOnce callbacks are unchanged from
 * the pre-D3 version. Only the JSX layout and CSS classes change.
 *
 * Layout: 12-col grid. Form (7 col) left, sticky EscrowSummary (5 col) right.
 * ≤1024px: single column, summary between form actions and the card bottom.
 */
import { useState, useId } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi, parseEventLogs } from 'viem'
import { isAddress } from 'viem'
import {
  ArrowLeft, Check, Clock, AlertCircle, Info,
  ChevronRight, ExternalLink, ArrowUpRight,
} from 'lucide-react'
import { CASCADE_ADDRESS, USDC_ADDRESS, TARGET_CHAIN_ID } from '@/lib/contracts'
import { cascadeAbi } from '@/lib/cascadeAbi'
import { useUsdcBalance, useUsdcAllowance } from '@/hooks/useUsdcBalance'
import { useSuccessOnce } from '@/hooks/useCascadeWrite'
import { triggerRefetch } from '@/lib/history'
import { IS_MAINNET, NETWORK_LABEL } from '@/lib/network'
import { useInvalidateCommitment, useInvalidateUsdcBalance } from '@/hooks/useInvalidate'
import { formatUsdc, parseUsdc, isPast, relativeDeadline } from '@/lib/format'
import { txUrl } from '@/lib/contracts'
import { Button } from './ui/Button'
import { TxStatus } from './ui/TxStatus'
import { WalletGate } from './ui/WalletGate'
import { Container } from './ui/Layout'
import { Card } from './ui/Card'
import { AddressDisplay } from './ui/Address'
import { Notice } from './ui/Notice'
import { Skeleton } from './ui/Skeleton'

interface Props {
  onNavigate: (view: string, id?: bigint) => void
}

/* ─────────────────────────────────────────────────────────────────────────────
   LearnMore — small inline doc link (14px, secondary colour, same-tab)
───────────────────────────────────────────────────────────────────────────── */
function LearnMore({ href }: { href: string }) {
  return (
    <a href={href} className="learn-more-link">
      Learn more <ArrowUpRight size={11} aria-hidden />
    </a>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Timezone helper
───────────────────────────────────────────────────────────────────────────── */
function tzLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const offset = -new Date().getTimezoneOffset()
    const sign = offset >= 0 ? '+' : '-'
    const h = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')
    const m = String(Math.abs(offset) % 60).padStart(2, '0')
    return `${tz}, UTC${sign}${h}:${m}`
  } catch { return '' }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Field wrapper — label, helper, error
───────────────────────────────────────────────────────────────────────────── */
function Field({
  label, helper, error, inputId, children,
}: {
  label:    string
  helper?:  string
  error?:   string
  inputId?: string
  children: React.ReactNode
}) {
  return (
    <div className="cr-field">
      <div className="cr-field-head">
        <label className="cr-label" htmlFor={inputId}>{label}</label>
        {helper && <span className="cr-helper">{helper}</span>}
      </div>
      {children}
      {error && (
        <p className="cr-error" role="alert">
          <AlertCircle size={12} aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Section header — 20px title + 14px description line
───────────────────────────────────────────────────────────────────────────── */
function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="cr-section-head">
      <h2 className="cr-section-title">{title}</h2>
      {desc && <p className="cr-section-desc">{desc}</p>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Quick picks for deadline
───────────────────────────────────────────────────────────────────────────── */
function QuickPick({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="cr-quick-pick" onClick={onClick}>{label}</button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Delegation diagram bar
───────────────────────────────────────────────────────────────────────────── */
function DelegBar({
  parsedAmount, parsedDelegation, reservedBudget,
}: {
  parsedAmount:     bigint
  parsedDelegation: bigint
  reservedBudget:   bigint
}) {
  const pct = parsedAmount > 0n
    ? Number((parsedDelegation * 10000n) / parsedAmount) / 100
    : 0
  const pctRes = 100 - pct

  return (
    <div className="cr-deleg-diagram">
      {/* Bar */}
      <div className="cr-deleg-bar" role="img" aria-label="Budget split diagram">
        {pct > 0 && (
          <div
            className="cr-deleg-seg cr-deleg-seg--lime"
            style={{ width: `${pct}%`, transition: 'width 250ms var(--ease)' }}
            aria-label={`Delegable: ${formatUsdc(parsedDelegation)} USDC`}
          />
        )}
        {pctRes > 0 && (
          <div
            className="cr-deleg-seg cr-deleg-seg--ink"
            style={{ width: `${pctRes}%`, transition: 'width 250ms var(--ease)' }}
            aria-label={`Reserve: ${formatUsdc(reservedBudget)} USDC`}
          />
        )}
      </div>
      {/* Legend */}
      <div className="cr-deleg-legend">
        <span className="cr-deleg-legend-item">
          <span className="cr-deleg-dot cr-deleg-dot--lime" />
          <span className="cr-deleg-legend-label">Delegable</span>
          <span className="cr-deleg-legend-val">{formatUsdc(parsedDelegation)} USDC</span>
        </span>
        <span className="cr-deleg-legend-item">
          <span className="cr-deleg-dot cr-deleg-dot--ink" />
          <span className="cr-deleg-legend-label">Protected reserve</span>
          <span className="cr-deleg-legend-val">{formatUsdc(reservedBudget)} USDC</span>
        </span>
      </div>
      {/* Sentence */}
      <p className="cr-deleg-sentence">
        Specialists can be allocated up to{' '}
        <strong>{formatUsdc(parsedDelegation)} USDC</strong>.{' '}
        <strong>{formatUsdc(reservedBudget)} USDC</strong> stays protected at the root
        until you approve or the objective fails.
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sign step row — numbered step with pending / confirming / done state
───────────────────────────────────────────────────────────────────────────── */
function SignStep({
  n, label, pending, confirming, done, hash,
}: {
  n:          number
  label:      string
  pending?:   boolean
  confirming?: boolean
  done?:      boolean
  hash?:      `0x${string}`
}) {
  const active = pending || confirming
  return (
    <div className={`cr-step${active ? ' cr-step--active' : ''}${done ? ' cr-step--done' : ''}`}>
      <span className="cr-step-num">{done ? <Check size={11} /> : n}</span>
      <span className="cr-step-label">{label}</span>
      {pending   && <span className="cr-step-badge cr-step-badge--waiting">In wallet…</span>}
      {confirming && <span className="cr-step-badge cr-step-badge--confirming">Confirming…</span>}
      {done && hash && (
        <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="cr-step-tx">
          View tx <ExternalLink size={9} />
        </a>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   EscrowSummary — right card (5 col)
───────────────────────────────────────────────────────────────────────────── */
interface SummaryProps {
  parsedAmount:     bigint | undefined
  parsedDelegation: bigint | undefined
  reservedBudget:   bigint | undefined
  balance:          bigint | undefined
  manager:          string
  deadlineTs:       bigint | undefined
  deadlineInput:    string
  needsApproval:    boolean
  formValid:        boolean
  firstUnmetReason: string | null
  isConnected:      boolean
  isWrongChain:     boolean
  reviewing:        boolean
  onReview:         () => void
  onCancelReview:   () => void
  onConfirm:        () => void
  // Approve state
  approvePending:   boolean
  approveConfirming: boolean
  approveSuccess:   boolean
  approveError:     boolean
  approveErr:       Error | null
  approveHash:      `0x${string}` | undefined
  resetApprove:     () => void
  // Create state
  createPending:    boolean
  createConfirming: boolean
  createSuccess:    boolean
  createErrored:    boolean
  createErr:        Error | null
  createHash:       `0x${string}` | undefined
  resetCreate:      () => void
  touchAll:         () => void
}

function EscrowSummary(p: SummaryProps) {
  const {
    parsedAmount, parsedDelegation, reservedBudget, balance, manager,
    deadlineTs, needsApproval, formValid, firstUnmetReason,
    isConnected, isWrongChain, reviewing, onReview, onCancelReview, onConfirm,
    approvePending, approveConfirming, approveSuccess, approveError, approveErr, approveHash, resetApprove,
    createPending, createConfirming, createSuccess, createErrored, createErr, createHash, resetCreate,
    touchAll,
  } = p

  const fmtAmt   = parsedAmount     !== undefined ? `${formatUsdc(parsedAmount)} USDC`     : '—'
  const fmtDeleg = parsedDelegation !== undefined ? `${formatUsdc(parsedDelegation)} USDC`  : '—'
  const fmtRes   = reservedBudget   !== undefined ? `${formatUsdc(reservedBudget)} USDC`    : '—'
  const afterBal = (balance !== undefined && parsedAmount !== undefined && parsedAmount <= balance)
    ? `${formatUsdc(balance - parsedAmount)} USDC`
    : '—'
  const dlStr    = deadlineTs
    ? new Date(Number(deadlineTs) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—'

  const kvItems = [
    { label: 'Leaves your wallet', value: <span className="cr-kv-amount">{fmtAmt}</span> },
    { label: 'Delegable capacity',  value: fmtDeleg },
    { label: 'Protected reserve',   value: fmtRes },
    { label: 'Your balance after',  value: afterBal },
    {
      label: 'Network',
      value: (
        <span className="cr-kv-network">
          <span className={`cr-net-dot${IS_MAINNET ? '' : ' cr-net-dot--test'}`} />
          {NETWORK_LABEL}
        </span>
      ),
    },
    {
      label: 'Contract',
      value: CASCADE_ADDRESS
        ? <AddressDisplay address={CASCADE_ADDRESS} identicon={false} copy explorer iconSize={16} />
        : '—',
    },
  ]

  /* Review plain-language paragraph */
  const reviewPara = parsedAmount && parsedDelegation !== undefined && reservedBudget !== undefined && deadlineTs && isAddress(manager)
    ? `You're escrowing ${formatUsdc(parsedAmount)} USDC on ${NETWORK_LABEL}. ` +
      `${formatUsdc(parsedDelegation)} USDC can be delegated by ${manager.slice(0, 6)}…${manager.slice(-4)}; ` +
      `${formatUsdc(reservedBudget)} USDC stays protected until you approve. ` +
      `Deadline ${dlStr}.`
    : null

  const signing = approvePending || approveConfirming || createPending || createConfirming

  return (
    <Card style={{ padding: 0 }}>
      <div className="cr-summary-head">
        <h2 className="cr-summary-title">Escrow summary</h2>
      </div>

      {/* KV rows */}
      <div className="cr-summary-kv">
        {kvItems.map((item, i) => (
          <div key={i} className="cr-kv-row">
            <span className="cr-kv-label">{item.label}</span>
            <span className="cr-kv-val">{item.value}</span>
          </div>
        ))}
      </div>

      {/* What you'll sign — only shown when connected on the right chain */}
      {isConnected && !isWrongChain && (
        <div className="cr-summary-steps">
          <p className="cr-steps-heading">
            What you'll sign
            <LearnMore href="/docs/creating-an-objective" />
          </p>
          {needsApproval && (
            <SignStep
              n={1}
              label={`Approve exactly ${parsedAmount ? formatUsdc(parsedAmount) : '—'} USDC`}
              pending={approvePending}
              confirming={approveConfirming}
              done={approveSuccess}
              hash={approveHash}
            />
          )}
          <SignStep
            n={needsApproval ? 2 : 1}
            label={`Create objective (escrows ${parsedAmount ? formatUsdc(parsedAmount) : '—'} USDC)`}
            pending={createPending}
            confirming={createConfirming}
            done={createSuccess}
            hash={createHash}
          />
        </div>
      )}

      {/* Action area */}
      <div className="cr-summary-action">
        {!isConnected || isWrongChain ? (
          <WalletGate isConnected={isConnected} isWrongChain={isWrongChain}>
            {/* WalletGate renders the connect / switch prompt */}
            <span />
          </WalletGate>
        ) : reviewing && reviewPara ? (
          /* ── Review state ── */
          <div className="cr-review-block">
            <p className="cr-review-para">{reviewPara}</p>
            {IS_MAINNET && (
              <Notice kind="warn" style={{ marginBottom: 12 }}>
                This uses real USDC on {NETWORK_LABEL}.
              </Notice>
            )}
            <p className="cr-final-note">
              Onchain transactions are final.{' '}
              <a href="/usage-risks" className="learn-more-link">See Usage &amp; Risks <ArrowUpRight size={11} aria-hidden /></a>
            </p>
            <div className="cr-review-btns">
              <Button variant="ghost" size="md" onClick={onCancelReview} disabled={signing}>
                Edit
              </Button>
              <Button variant="primary" size="md"
                loading={signing}
                onClick={() => {
                  touchAll()
                  if (formValid) onConfirm()
                }}
              >
                {approvePending || approveConfirming ? 'Approving…'
                  : createPending || createConfirming ? 'Creating…'
                  : createSuccess ? 'Created — redirecting…'
                  : needsApproval ? 'Approve USDC'
                  : 'Confirm & sign'}
              </Button>
            </div>
            <TxStatus isPending={approvePending} isConfirming={approveConfirming} isSuccess={approveSuccess} isError={approveError} error={approveErr} successLabel="Approved — sign next tx" onDismiss={resetApprove} />
            <TxStatus isPending={createPending} isConfirming={createConfirming} isSuccess={createSuccess} isError={createErrored} error={createErr} hash={createHash} successLabel="Objective created" onDismiss={resetCreate} />
          </div>
        ) : (
          /* ── Review button ── */
          <div>
            <Button variant="primary" size="lg" style={{ width: '100%' }}
              disabled={!formValid}
              onClick={() => { touchAll(); if (formValid) onReview() }}
            >
              Review <ChevronRight size={14} />
            </Button>
            {!formValid && firstUnmetReason && (
              <p className="cr-unmet">{firstUnmetReason}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   CreateRoot — main export
   All state, hooks, validation, handleApprove, handleCreate, useSuccessOnce
   are UNCHANGED from pre-D3. Only the JSX structure changes.
───────────────────────────────────────────────────────────────────────────── */
export function CreateRoot({ onNavigate }: Props) {
  // ── All state unchanged ─────────────────────────────────────────────────────
  const { address, isConnected, chainId } = useAccount()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID

  const [manager,       setManager]       = useState('')
  const [amount,        setAmount]        = useState('')
  const [delegation,    setDelegation]    = useState('')
  const [deadlineInput, setDeadlineInput] = useState('')
  const [title,         setTitle]         = useState('')
  const [reviewing,     setReviewing]     = useState(false)

  /* Touched state for inline blur errors */
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const touch = (k: string) => setTouched(t => ({ ...t, [k]: true }))

  const { data: balance } = useUsdcBalance(address)
  const { data: allowance, refetch: refetchAllowance } = useUsdcAllowance(address, CASCADE_ADDRESS as `0x${string}`)

  const parsedAmount     = parseUsdc(amount)
  const parsedDelegation = parseUsdc(delegation)
  const reservedBudget   = (parsedAmount && parsedDelegation !== undefined && parsedDelegation <= parsedAmount)
    ? parsedAmount - parsedDelegation : undefined
  const deadlineTs       = deadlineInput ? BigInt(Math.floor(new Date(deadlineInput).getTime() / 1000)) : undefined
  const needsApproval    = parsedAmount !== undefined && (allowance === undefined || allowance < parsedAmount)

  /* Errors — UNCHANGED */
  const errTitle    = touched.title    && !title.trim()                              ? 'Title is required' : ''
  const errManager  = touched.manager  && manager && !isAddress(manager)            ? 'Must be a valid 0x address' : ''
  const errAmount   = touched.amount   && parsedAmount !== undefined && balance !== undefined && parsedAmount > balance
    ? `Insufficient balance (you have ${formatUsdc(balance)} USDC)` : ''
  const errDeleg    = touched.deleg    && parsedDelegation !== undefined && parsedAmount !== undefined && parsedDelegation > parsedAmount
    ? 'Cannot exceed total budget' : ''
  const errDeadline = touched.deadline && deadlineTs !== undefined && isPast(deadlineTs)
    ? 'Must be in the future' : ''

  // ── Approve tx — UNCHANGED ──────────────────────────────────────────────────
  const { writeContract: approveWrite, data: approveHash, isPending: approvePending, isError: approveError, error: approveErr, reset: resetApprove } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash, chainId: TARGET_CHAIN_ID })

  // ── CreateRoot tx — UNCHANGED ───────────────────────────────────────────────
  const { writeContract: createWrite, data: createHash, isPending: createPending, isError: createErrored, error: createErr, reset: resetCreate } = useWriteContract()
  const { isLoading: createConfirming, isSuccess: createSuccess, data: createReceipt } = useWaitForTransactionReceipt({ hash: createHash, chainId: TARGET_CHAIN_ID })

  const invalidateCommitments = useInvalidateCommitment()
  const invalidateBalance     = useInvalidateUsdcBalance()

  // ── useSuccessOnce callbacks — UNCHANGED ────────────────────────────────────
  useSuccessOnce(approveSuccess, approveHash, () => {
    void refetchAllowance()
    invalidateBalance()
  })

  useSuccessOnce(createSuccess, createHash, () => {
    invalidateCommitments()
    invalidateBalance()
    triggerRefetch()
    if (createReceipt) {
      try {
        const logs = parseEventLogs({ abi: cascadeAbi, logs: createReceipt.logs, eventName: 'RootCreated' })
        const id = (logs[0]?.args as { id?: bigint } | undefined)?.id
        if (id !== undefined) { setTimeout(() => onNavigate('commitment', id), 800); return }
      } catch { /* fall through */ }
    }
    setTimeout(() => onNavigate('explore'), 800)
  })

  // ── Validation — UNCHANGED ──────────────────────────────────────────────────
  const formValid =
    isAddress(manager) &&
    parsedAmount !== undefined && parsedAmount > 0n &&
    parsedDelegation !== undefined && parsedDelegation <= parsedAmount &&
    deadlineTs !== undefined && deadlineTs > 0n &&
    title.trim().length > 0

  // ── handleApprove — UNCHANGED ───────────────────────────────────────────────
  // File: src/components/CreateRoot.tsx:280
  function handleApprove() {
    if (!parsedAmount) return
    approveWrite({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [CASCADE_ADDRESS as `0x${string}`, parsedAmount], chainId: TARGET_CHAIN_ID })
  }

  // ── handleCreate — UNCHANGED ────────────────────────────────────────────────
  // File: src/components/CreateRoot.tsx:287
  function handleCreate() {
    if (!parsedAmount || parsedDelegation === undefined || !deadlineTs || !isAddress(manager)) return
    createWrite({ address: CASCADE_ADDRESS as `0x${string}`, abi: cascadeAbi, functionName: 'createRoot', args: [manager, parsedAmount, parsedDelegation, deadlineTs, title.trim()], chainId: TARGET_CHAIN_ID })
  }

  const [minDate] = useState(() => new Date(Date.now() + 3600_000).toISOString().slice(0, 16))

  const firstUnmetReason: string | null = !title.trim()
    ? 'Add a title'
    : !manager
    ? 'Enter a manager address'
    : manager && !isAddress(manager)
    ? 'Enter a valid 0x manager address'
    : !parsedAmount || parsedAmount === 0n
    ? 'Enter a budget greater than zero'
    : balance !== undefined && parsedAmount > balance
    ? `Budget exceeds your USDC balance (${formatUsdc(balance)})`
    : parsedDelegation === undefined || parsedDelegation > (parsedAmount ?? 0n)
    ? 'Delegation limit cannot exceed budget'
    : !deadlineTs || deadlineTs === 0n
    ? 'Pick a deadline'
    : deadlineTs !== undefined && isPast(deadlineTs)
    ? 'Deadline must be in the future'
    : null

  function touchAll() { setTouched({ title: true, manager: true, amount: true, deleg: true, deadline: true }) }

  /* When "Confirm & sign" is pressed in review mode, run the right tx */
  function handleConfirm() {
    if (needsApproval) { handleApprove() } else { handleCreate() }
  }

  /* Auto-advance: once approve succeeds and no create tx yet, run create */
  useSuccessOnce(approveSuccess && !createHash, approveHash, () => {
    if (formValid) handleCreate()
  })

  /* IDs for aria-describedby */
  const idTitle    = useId()
  const idManager  = useId()
  const idAmount   = useId()
  const idDeleg    = useId()
  const idDeadline = useId()

  /* Quick-pick helpers */
  function addDays(n: number) {
    const d = new Date(Date.now() + n * 86_400_000)
    setDeadlineInput(d.toISOString().slice(0, 16))
    touch('deadline')
  }

  /* Relative deadline label */
  const dlRel = deadlineTs && !isPast(deadlineTs) ? relativeDeadline(deadlineTs) : ''

  /* Max budget shortcut */
  function setMax() {
    if (balance !== undefined) {
      setAmount(formatUsdc(balance, { digits: 6 }).replace(/,/g, ''))
      touch('amount')
    }
  }

  /* Budget slider: 0..parsedAmount → parsedDelegation */
  const sliderMax = parsedAmount ? Number(parsedAmount / 1_000_000n) * 100 : 10000
  const sliderVal = parsedDelegation ? Math.min(Number(parsedDelegation / 1_000_000n) * 100, sliderMax) : 0

  /* ── JSX ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="cr-page">
      <Container>
        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="cr-page-head">
          <div>
            <p className="cr-kicker">NEW OBJECTIVE</p>
            <h1 className="cr-title">New objective</h1>
            <p className="cr-desc">Define the work and spending boundary. Review before committing.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('explore')}>
            <ArrowLeft size={13} /> Cancel
          </Button>
        </div>

        {/* ── 12-col grid ──────────────────────────────────────────── */}
        <div className="cr-grid">

          {/* ═══════════════ FORM CARD (7 col) ═════════════════════ */}
          <Card style={{ padding: 0 }} className="cr-form-card">

            {/* ── Section 1: Work ───────────────────────────────── */}
            <div className="cr-section">
              <SectionHead title="Work" desc="The title is stored publicly onchain." />
              <Field label="Title" error={errTitle} inputId={idTitle}>
                <input
                  id={idTitle}
                  className="input cr-input-title"
                  placeholder="E.g. Build the landing page"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onBlur={() => touch('title')}
                  maxLength={100}
                  aria-describedby={errTitle ? `${idTitle}-err` : undefined}
                  aria-invalid={!!errTitle}
                  style={{ borderColor: errTitle ? 'var(--bad)' : undefined }}
                />
              </Field>
            </div>

            {/* ── Section 2: Lead manager ──────────────────────── */}
            <div className="cr-section">
              <SectionHead
                title="Lead manager"
                desc="The address responsible for delivering the work."
              />
              <Field label="Manager address" error={errManager} inputId={idManager}>
                <input
                  id={idManager}
                  className="input input-mono"
                  placeholder="0x…"
                  value={manager}
                  onChange={e => setManager(e.target.value)}
                  onBlur={() => touch('manager')}
                  aria-describedby={errManager ? `${idManager}-err` : undefined}
                  aria-invalid={!!errManager}
                  style={{ borderColor: errManager ? 'var(--bad)' : undefined }}
                />
                {/* Address preview once valid */}
                {isAddress(manager) && (
                  <div className="cr-addr-preview">
                    <AddressDisplay address={manager} identicon copy={false} explorer={false} iconSize={20} />
                    {manager.toLowerCase() === address?.toLowerCase() && (
                      <span className="cr-you-note">You'll be client and manager</span>
                    )}
                  </div>
                )}
                {/* Use my wallet */}
                {address && !isAddress(manager) && (
                  <button
                    type="button"
                    className="cr-use-wallet"
                    onClick={() => { setManager(address); touch('manager') }}
                  >
                    Use my wallet
                  </button>
                )}
              </Field>
            </div>

            {/* ── Section 3: Deadline ──────────────────────────── */}
            <div className="cr-section">
              <SectionHead
                title="Deadline"
                desc={tzLabel() ? `Times are in your local timezone (${tzLabel()}).` : undefined}
              />
              <Field label="Deadline" error={errDeadline} inputId={idDeadline}>
                <div className="cr-deadline-row">
                  <input
                    id={idDeadline}
                    type="datetime-local"
                    className="input cr-input-deadline"
                    min={minDate}
                    value={deadlineInput}
                    onChange={e => setDeadlineInput(e.target.value)}
                    onBlur={() => touch('deadline')}
                    aria-describedby={errDeadline ? `${idDeadline}-err` : undefined}
                    aria-invalid={!!errDeadline}
                    style={{ borderColor: errDeadline ? 'var(--bad)' : undefined }}
                  />
                  {dlRel && <span className="cr-dl-rel"><Clock size={11} />{dlRel}</span>}
                </div>
                <div className="cr-quick-picks">
                  <QuickPick label="+1 day"  onClick={() => addDays(1)} />
                  <QuickPick label="+7 days" onClick={() => addDays(7)} />
                  <QuickPick label="+30 days" onClick={() => addDays(30)} />
                </div>
              </Field>
            </div>

            {/* ── Section 4: Budget & delegation ───────────────── */}
            <div className="cr-section">
              <SectionHead
                title="Budget &amp; delegation"
                desc="Set the total USDC and how much the manager can delegate downstream."
              />
              <div className="cr-section-learn"><LearnMore href="/docs/delegation-and-reserve" /></div>

              {/* Budget input */}
              <Field
                label="Total budget"
                helper={balance !== undefined ? `Balance ${formatUsdc(balance)}` : undefined}
                error={errAmount}
                inputId={idAmount}
              >
                <div className="cr-amount-row">
                  <input
                    id={idAmount}
                    className="input input-mono cr-input-amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={e => {
                      const v = e.target.value.replace(/[^0-9.]/g, '')
                      if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                    }}
                    onBlur={() => touch('amount')}
                    aria-describedby={errAmount ? `${idAmount}-err` : undefined}
                    aria-invalid={!!errAmount}
                    style={{ borderColor: errAmount ? 'var(--bad)' : undefined }}
                  />
                  <span className="cr-amount-unit">USDC</span>
                  {balance !== undefined && (
                    <button type="button" className="cr-max-btn" onClick={setMax}>Max</button>
                  )}
                </div>
                {balance === undefined && <Skeleton width={120} height={12} style={{ marginTop: 6 }} />}
              </Field>

              {/* Delegation limit — slider + input */}
              <Field
                label="Delegation limit"
                error={errDeleg}
                inputId={idDeleg}
              >
                <div className="cr-deleg-row">
                  <input
                    type="range"
                    className="cr-slider"
                    min={0}
                    max={sliderMax}
                    step={1}
                    value={sliderVal}
                    aria-label="Delegation limit slider"
                    onChange={e => {
                      const raw = Number(e.target.value)
                      const usdc = BigInt(raw) * 10_000n
                      setDelegation(formatUsdc(usdc, { digits: 6 }).replace(/,/g, ''))
                    }}
                  />
                  <div className="cr-deleg-input-wrap">
                    <input
                      id={idDeleg}
                      className="input input-mono cr-input-deleg"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={delegation}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9.]/g, '')
                        if (v === '' || /^\d*\.?\d*$/.test(v)) setDelegation(v)
                      }}
                      onBlur={() => touch('deleg')}
                      aria-describedby={errDeleg ? `${idDeleg}-err` : undefined}
                      aria-invalid={!!errDeleg}
                      style={{ borderColor: errDeleg ? 'var(--bad)' : undefined }}
                    />
                    <span className="cr-amount-unit">USDC</span>
                  </div>
                </div>
                <p className="cr-deleg-hint">
                  <Info size={11} aria-hidden />
                  0 = no delegation · equal to budget = full delegation
                </p>
              </Field>

              {/* Diagram — only when both values are valid */}
              {parsedAmount !== undefined && parsedAmount > 0n &&
               parsedDelegation !== undefined && parsedDelegation <= parsedAmount &&
               reservedBudget !== undefined && (
                <DelegBar
                  parsedAmount={parsedAmount}
                  parsedDelegation={parsedDelegation}
                  reservedBudget={reservedBudget}
                />
              )}
            </div>
          </Card>

          {/* ═══════════════ SUMMARY CARD (5 col) ══════════════════ */}
          <div className="cr-summary-sticky">
            <EscrowSummary
              parsedAmount={parsedAmount}
              parsedDelegation={parsedDelegation}
              reservedBudget={reservedBudget}
              balance={balance}
              manager={manager}
              deadlineTs={deadlineTs}
              deadlineInput={deadlineInput}
              needsApproval={needsApproval}
              formValid={formValid}
              firstUnmetReason={firstUnmetReason}
              isConnected={isConnected}
              isWrongChain={wrongChain}
              reviewing={reviewing}
              onReview={() => setReviewing(true)}
              onCancelReview={() => setReviewing(false)}
              onConfirm={handleConfirm}
              approvePending={approvePending}
              approveConfirming={approveConfirming}
              approveSuccess={approveSuccess}
              approveError={approveError}
              approveErr={approveErr}
              approveHash={approveHash}
              resetApprove={resetApprove}
              createPending={createPending}
              createConfirming={createConfirming}
              createSuccess={createSuccess}
              createErrored={createErrored}
              createErr={createErr}
              createHash={createHash}
              resetCreate={resetCreate}
              touchAll={touchAll}
            />
          </div>

        </div>{/* /cr-grid */}
      </Container>
    </div>
  )
}
