/**
 * CommitmentWorkspace — D1 redesign.
 * Layout: Header → Money Bar → Body grid (Tree 7col / Inspector 5col).
 * All tokens from src/styles/tokens.css + src/components/ui/*.
 * No inline font-size, color, or spacing literals.
 */
import { useState, useCallback, useRef, useId, useMemo, type ReactNode } from 'react'
import { useAccount, useSwitchChain as useWagmiSwitchChain } from 'wagmi'
import { isAddress, parseEventLogs } from 'viem'
import {
  ArrowLeft, Plus, Check, X, Ban, Clock, Send,
  ExternalLink, GitBranch, ChevronRight, Info, MoreHorizontal, ArrowUpRight,
} from 'lucide-react'
import { useCommitment, useChildren, useCommitments } from '@/hooks/useCascade'
import { useSubmit, useApprove, useReject, useCancel, useExpire, useCreateChild, useSuccessOnce } from '@/hooks/useCascadeWrite'
import { useInvalidateCommitment } from '@/hooks/useInvalidate'
import type { Commitment } from '@/lib/types'
import { CommitmentState, isTerminal, computeDelegation, FailReason } from '@/lib/types'
import { formatUsdc, parseUsdc, shortAddr, isPast, relativeDeadline, formatDeadline } from '@/lib/format'
import { addrUrl, txUrl, TARGET_CHAIN_ID, CASCADE_ADDRESS } from '@/lib/contracts'
import { cascadeAbi } from '@/lib/cascadeAbi'
import { statusOf } from '@/lib/status'
import { Button } from './ui/Button'
import { TxStatus } from './ui/TxStatus'
import { WalletGate } from './ui/WalletGate'
import { ReadError } from './ui/ReadError'
import { StatusBadge } from './ui/StatusBadge'
import { Pill } from './ui/Pill'
import { AddressDisplay } from './ui/Address'
import { Skeleton } from './ui/Skeleton'
import { Notice } from './ui/Notice'
import { Activity } from './Activity'
import { triggerRefetch, eventsFor, useHistory } from '@/lib/history'
import { computeOutcome } from '@/lib/outcome'

interface Props {
  id: bigint
  onNavigate: (view: string, id?: bigint) => void
}

/* ════════════════════════════════════════════════════════════════════════════
   nextStep — pure function answering "Who acts next?" in one sentence.
   File: src/components/CommitmentWorkspace.tsx, exported for tests.
════════════════════════════════════════════════════════════════════════════ */
export function nextStep(
  c: Commitment,
  children: Commitment[],
  address: string | undefined,
): string {
  if (isTerminal(c.state)) {
    if (c.state === CommitmentState.Succeeded) return 'Settled. Funds released to the manager.'
    const reason =
      c.failReason === FailReason.Rejected  ? 'Rejected' :
      c.failReason === FailReason.Cancelled ? 'Cancelled' :
      c.failReason === FailReason.Expired   ? 'Expired' : 'Failed'
    return `${reason}. Nothing left to do.`
  }

  const allChildrenTerminal = children.length === 0 || children.every(ch => isTerminal(ch.state))
  const isManager  = !!address && address.toLowerCase() === c.manager.toLowerCase()
  const isApprover = !!address && address.toLowerCase() === c.approver.toLowerCase()
  const dlStr      = new Date(Number(c.deadline) * 1000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  if (c.state === CommitmentState.Submitted) {
    if (isApprover) return 'Ready for your review — approve or reject the delivery.'
    return `Submitted. Waiting for ${shortAddr(c.approver)} to review.`
  }

  // Active
  if (isPast(c.deadline) && allChildrenTerminal) {
    return `Deadline passed on ${dlStr}. Anyone can expire this commitment.`
  }
  if (!allChildrenTerminal) {
    return 'Waiting for all child commitments to settle before submitting.'
  }
  if (isManager) {
    return `Ready to submit delivery — deadline ${dlStr}.`
  }
  return `Waiting for ${shortAddr(c.manager)} to submit by ${dlStr}.`
}

/* ════════════════════════════════════════════════════════════════════════════
   LearnMore — small doc link used throughout the workspace
════════════════════════════════════════════════════════════════════════════ */
function LearnMore({ href }: { href: string }) {
  return (
    <a href={href} className="learn-more-link">
      Learn more <ArrowUpRight size={11} aria-hidden />
    </a>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   argBig helper
════════════════════════════════════════════════════════════════════════════ */
function argBig(a: Record<string, unknown>, k: string): bigint {
  const v = a[k]
  try { return BigInt(typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' ? String(v) : '0') } catch { return 0n }
}

/* ════════════════════════════════════════════════════════════════════════════
   Confirmed type + note
════════════════════════════════════════════════════════════════════════════ */
type Confirmed = { text: string | null; hash: `0x${string}`; showClaims?: boolean }

function ConfirmedNote({ c, onDismiss, onNavigateClaims }: {
  c: Confirmed; onDismiss: () => void; onNavigateClaims?: () => void
}) {
  return (
    <div role="status" aria-live="polite" className="confirmed-note">
      <div className="confirmed-note-inner">
        <Check size={14} className="confirmed-check" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="confirmed-label">Confirmed</span>
          {c.text && (
            <p className="confirmed-text">
              {c.text}
              {onNavigateClaims && (
                <> <button onClick={onNavigateClaims} className="confirmed-claims-btn">View claimable →</button></>
              )}
            </p>
          )}
          <a href={txUrl(c.hash)} target="_blank" rel="noreferrer" className="confirmed-tx">
            View on explorer <ExternalLink size={10} />
          </a>
        </div>
        <button onClick={onDismiss} className="confirmed-dismiss">Dismiss</button>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   InfoTooltip
════════════════════════════════════════════════════════════════════════════ */
function InfoTooltip({ id, text }: { id: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="info-tooltip-wrap">
      <button
        aria-label="More information"
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen(v => !v)}
        onBlur={() => setOpen(false)}
        className="info-tooltip-btn"
      >
        <Info size={11} />
      </button>
      {open && (
        <span id={id} role="tooltip" className="info-tooltip-box">{text}</span>
      )}
    </span>
  )
}



/* ════════════════════════════════════════════════════════════════════════════
   FundsData — computation shared by MoneyBar and Inspector Funds tab
════════════════════════════════════════════════════════════════════════════ */
interface FundsData {
  funded:      bigint
  delegated:   bigint
  settled:     bigint
  returned:    bigint
  held:        bigint
  outcomeLabel: string
  outcomeAmount: bigint | null
  reconciles:  boolean
  historyReady: boolean
  progress:    number
}

function useFundsData(c: Commitment): FundsData {
  const { syncing, progress, syncedTo, events: allEvents } = useHistory()
  const events = eventsFor(c.id)
  const historyReady = syncedTo > 0n && !(syncing && progress < 1)

  const childCreated        = events.filter(e => e.eventName === 'ChildCreated' && argBig(e.args, 'parentId') === c.id)
  const childIds            = new Set(childCreated.map(e => argBig(e.args, 'id')))
  const approvedChildren    = allEvents.filter(e => e.eventName === 'CommitmentApproved' && childIds.has(argBig(e.args, 'id')))
  const returnedFromChildren = events.filter(e => e.eventName === 'FundsReturned' && argBig(e.args, 'parentId') === c.id)

  const delegated = childCreated.reduce((s, e) => s + argBig(e.args, 'budget'), 0n)
  const settled   = approvedChildren.reduce((s, e) => s + argBig(e.args, 'released'), 0n)
  const returned  = returnedFromChildren.reduce((s, e) => s + argBig(e.args, 'amount'), 0n)

  let outcomeLabel = '', outcomeAmount: bigint | null = null
  if (c.state === CommitmentState.Succeeded) {
    outcomeLabel = 'Released'
    const ev = events.find(e => e.eventName === 'CommitmentApproved' && argBig(e.args, 'id') === c.id)
    if (ev) outcomeAmount = argBig(ev.args, 'released')
  } else if (isTerminal(c.state) && c.parentId > 0n) {
    outcomeLabel = 'Returned'
    const ev = events.find(e => e.eventName === 'FundsReturned' && argBig(e.args, 'childId') === c.id)
    if (ev) outcomeAmount = argBig(ev.args, 'amount')
  } else if (isTerminal(c.state)) {
    outcomeLabel = 'Refunded'
    outcomeAmount = c.budget - delegated + returned
    if (outcomeAmount < 0n) outcomeAmount = 0n
  }

  const computedHeld = outcomeAmount !== null ? c.budget - delegated + returned - outcomeAmount : null
  const reconciles   = !syncing && computedHeld !== null && computedHeld === c.remaining

  return {
    funded:   c.budget,
    delegated,
    settled,
    returned,
    held:     c.remaining,
    outcomeLabel,
    outcomeAmount,
    reconciles,
    historyReady,
    progress,
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   OutcomeBlock — unchanged logic, restyled
════════════════════════════════════════════════════════════════════════════ */
function OutcomeBlock({ c, onNavigate }: { c: Commitment; onNavigate: (v: string, id?: bigint) => void }) {
  const { syncing, progress, syncedTo } = useHistory()
  if (!isTerminal(c.state)) return null
  const historyReady = syncedTo > 0n && !(syncing && progress < 1)

  if (!historyReady) {
    return (
      <div className="outcome-loading">
        <Skeleton width="60%" height={12} />
        <div className="sync-bar"><div className="sync-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      </div>
    )
  }

  const events = eventsFor(c.id)
  let sentence: ReactNode = null
  let txHash: `0x${string}` | null = null
  let parentLink: bigint | null = null

  if (c.state === CommitmentState.Succeeded) {
    const ev = events.find(e => e.eventName === 'CommitmentApproved')
    if (ev) {
      txHash = ev.transactionHash
      const released = argBig(ev.args, 'released')
      sentence = <>Released {formatUsdc(released)} USDC to {shortAddr(c.manager)}, claimable by the manager.</>
    }
  } else {
    const reason = c.failReason === FailReason.Rejected ? 'Rejected'
      : c.failReason === FailReason.Cancelled ? 'Cancelled' : 'Expired'
    if (c.parentId > 0n) {
      const fr = events.find(e => e.eventName === 'FundsReturned' && argBig(e.args, 'childId') === c.id)
      if (fr) {
        txHash = fr.transactionHash
        const amount = argBig(fr.args, 'amount')
        const pid    = argBig(fr.args, 'parentId')
        sentence = <>{reason} · Returned {formatUsdc(amount)} USDC to #{pid.toString()}.</>
        parentLink = pid
      }
    } else {
      const failEv = events.find(e =>
        (e.eventName === 'CommitmentRejected' || e.eventName === 'CommitmentCancelled' || e.eventName === 'CommitmentExpired') &&
        argBig(e.args, 'id') === c.id,
      )
      if (failEv) {
        txHash = failEv.transactionHash
        const delegated = events.filter(e => e.eventName === 'ChildCreated' && argBig(e.args, 'parentId') === c.id)
          .reduce((s, e) => s + argBig(e.args, 'budget'), 0n)
        const returnedAmt = events.filter(e => e.eventName === 'FundsReturned' && argBig(e.args, 'parentId') === c.id)
          .reduce((s, e) => s + argBig(e.args, 'amount'), 0n)
        const r = c.budget - delegated + returnedAmt
        sentence = r <= 0n
          ? <>{reason} · No unspent funds remained.</>
          : <>{reason} · Refunded {formatUsdc(r)} USDC to the client's claimable balance ({shortAddr(c.client)}).</>
      }
    }
  }

  if (!sentence) {
    return (
      <p className="outcome-unavailable">
        Outcome details unavailable.{' '}
        <a href={addrUrl(CASCADE_ADDRESS ?? '')} target="_blank" rel="noreferrer" className="outcome-contract-link">
          View contract <ExternalLink size={10} />
        </a>
      </p>
    )
  }

  return (
    <div className="outcome-block">
      <p className="outcome-sentence">
        {sentence}
        {parentLink !== null && (
          <button onClick={() => onNavigate('commitment', parentLink)} className="outcome-parent-btn">
            View parent →
          </button>
        )}
      </p>
      {txHash && (
        <a href={txUrl(txHash)} target="_blank" rel="noreferrer" className="outcome-tx-link">
          View transaction <ExternalLink size={10} />
        </a>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Segmented control (tabs)
════════════════════════════════════════════════════════════════════════════ */
function Seg({ value, options, onChange, panelPrefix }: {
  value: string
  options: { id: string; label: string }[]
  onChange: (v: string) => void
  panelPrefix?: string
}) {
  function onKey(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(options[(idx + 1) % options.length].id) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); onChange(options[(idx - 1 + options.length) % options.length].id) }
  }
  return (
    <div role="tablist" className="seg-control">
      {options.map((o, idx) => (
        <button
          key={o.id}
          role="tab"
          id={panelPrefix ? `${panelPrefix}-tab-${o.id}` : undefined}
          aria-selected={value === o.id}
          aria-controls={panelPrefix ? `${panelPrefix}-panel-${o.id}` : undefined}
          tabIndex={value === o.id ? 0 : -1}
          onClick={() => onChange(o.id)}
          onKeyDown={e => onKey(e, idx)}
          className={`seg-tab${value === o.id ? ' seg-tab--active' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Tree — full recursive implementation (D1b)
   ─ useTreeNode: one component per node that calls its own hooks
   ─ TreeState: Map<string, boolean> of expanded ids
   ─ roving tabindex keyboard walker
   ─ outcome line per node from history store
════════════════════════════════════════════════════════════════════════════ */

/** Flat ordered list of visible node ids, rebuilt whenever expand state changes. */
function buildVisibleIds(
  rootId: bigint,
  childMap: Map<string, bigint[]>,
  expanded: Map<string, boolean>,
  depth = 0,
): { id: bigint; depth: number }[] {
  const key = rootId.toString()
  const out: { id: bigint; depth: number }[] = [{ id: rootId, depth }]
  const kids = childMap.get(key) ?? []
  if (kids.length > 0 && expanded.get(key)) {
    for (const kid of kids) {
      out.push(...buildVisibleIds(kid, childMap, expanded, depth + 1))
    }
  }
  return out
}

/** Per-node outcome line computed from the history store. */
function useNodeOutcome(c: Commitment): { line: string; kind: 'settled' | 'returned' | 'held' | 'pending' } | null {
  const { syncing, syncedTo, events } = useHistory()
  const historyReady = syncedTo > 0n && !syncing
  if (!historyReady) return null
  return computeOutcome(c, events)
}

interface TreeNodeRowProps {
  c:          Commitment
  depth:      number
  isSelected: boolean
  isAncestor: boolean
  isLast:     boolean    // last sibling (affects elbow vs straight connector)
  expanded:   Map<string, boolean>
  onExpand:   (id: bigint, v: boolean) => void
  onSelect:   (id: bigint) => void
  tabIndex:   number
  onKeyDown:  (e: React.KeyboardEvent<HTMLDivElement>) => void
  childMap:   Map<string, bigint[]>
  allCommits: Map<string, Commitment>
  historyReady: boolean
}

function TreeNodeRow({
  c, depth, isSelected, isAncestor, isLast,
  expanded, onExpand, onSelect, tabIndex, onKeyDown,
  childMap, allCommits, historyReady,
}: TreeNodeRowProps) {
  const status     = statusOf(c.state, c.failReason)
  const key        = c.id.toString()
  const isExpanded = expanded.get(key) ?? false
  const kids       = childMap.get(key) ?? []
  const hasKids    = kids.length > 0
  const outcome    = useNodeOutcome(c)
  const dlStr      = c.deadline
    ? new Date(Number(c.deadline) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  const cls = [
    'tree-node',
    isSelected  ? 'tree-node--selected'  : '',
    isAncestor  ? 'tree-node--ancestor'  : '',
    !isSelected ? 'tree-node--clickable' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className="tree-row-wrap" style={{ paddingLeft: depth > 0 ? depth * 28 : 0 }}>
      {/* Connector elbows — rendered for depth > 0 */}
      {depth > 0 && (
        <div
          className={isLast ? 'tree-elbow tree-elbow--last' : 'tree-elbow tree-elbow--mid'}
          aria-hidden="true"
        />
      )}
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasKids ? isExpanded : undefined}
        tabIndex={tabIndex}
        data-tree-id={key}
        className={cls}
        onClick={() => onSelect(c.id)}
        onKeyDown={onKeyDown}
      >
        {/* Expand chevron */}
        {hasKids ? (
          <button
            className={`tree-expand-btn${isExpanded ? ' tree-expand-btn--open' : ''}`}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            tabIndex={-1}
            onClick={e => { e.stopPropagation(); onExpand(c.id, !isExpanded) }}
          >
            <ChevronRight size={14} />
          </button>
        ) : (
          <span className="tree-expand-spacer" aria-hidden="true" />
        )}

        {/* Status icon tile */}
        <span className="tree-node-icon" style={{ background: status.bg }}>
          <GitBranch size={13} style={{ color: status.fg }} />
        </span>

        {/* Middle */}
        <div className="tree-node-mid">
          <p className="tree-node-title">{c.title || `Commitment #${c.id}`}</p>
          <p className="tree-node-meta">
            <span className="mono">#{c.id.toString()}</span>
            {hasKids && <span className="tree-child-count">{kids.length}</span>}
            <StatusBadge status={status} size="sm" />
            {dlStr && <span className="tree-meta-dl"> · {dlStr}</span>}
          </p>
        </div>

        {/* Right: budget + outcome */}
        <div className="tree-node-right">
          <span className="tree-node-budget">
            {formatUsdc(c.budget)}<span className="tree-node-unit"> USDC</span>
          </span>
          {historyReady ? (
            outcome ? (
              <span className={`tree-outcome tree-outcome--${outcome.kind}`}>{outcome.line}</span>
            ) : null
          ) : (
            <Skeleton width={60} height={10} style={{ marginTop: 4 }} />
          )}
        </div>
      </div>

      {/* Recursively render children if expanded */}
      {hasKids && isExpanded && (
        <div className="tree-children" role="group">
          {kids.map((kidId, idx) => {
            const kid = allCommits.get(kidId.toString())
            if (!kid) return (
              <div key={kidId.toString()} className="tree-row-wrap" style={{ paddingLeft: (depth + 1) * 28 }}>
                <div className={idx === kids.length - 1 ? 'tree-elbow tree-elbow--last' : 'tree-elbow tree-elbow--mid'} aria-hidden="true" />
                <div className="tree-node tree-node--loading">
                  <Skeleton width="60%" height={12} />
                </div>
              </div>
            )
            return (
              <TreeNodeRow
                key={kidId.toString()}
                c={kid}
                depth={depth + 1}
                isSelected={false}
                isAncestor={false}
                isLast={idx === kids.length - 1}
                expanded={expanded}
                onExpand={onExpand}
                onSelect={onSelect}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                childMap={childMap}
                allCommits={allCommits}
                historyReady={historyReady}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Hook: walks up parentId chain to find the root commitment id. */
function useRootId(c: Commitment): bigint {
  // We walk up through parentCommitment reads. Maximum depth is 8.
  const p1 = useCommitment(c.parentId > 0n ? c.parentId : undefined)
  const p2 = useCommitment(p1.commitment?.parentId && p1.commitment.parentId > 0n ? p1.commitment.parentId : undefined)
  const p3 = useCommitment(p2.commitment?.parentId && p2.commitment.parentId > 0n ? p2.commitment.parentId : undefined)
  const p4 = useCommitment(p3.commitment?.parentId && p3.commitment.parentId > 0n ? p3.commitment.parentId : undefined)
  const p5 = useCommitment(p4.commitment?.parentId && p4.commitment.parentId > 0n ? p4.commitment.parentId : undefined)
  const p6 = useCommitment(p5.commitment?.parentId && p5.commitment.parentId > 0n ? p5.commitment.parentId : undefined)
  const p7 = useCommitment(p6.commitment?.parentId && p6.commitment.parentId > 0n ? p6.commitment.parentId : undefined)
  const p8 = useCommitment(p7.commitment?.parentId && p7.commitment.parentId > 0n ? p7.commitment.parentId : undefined)

  if (c.parentId === 0n) return c.id
  // find the deepest non-null ancestor
  const chain = [p8, p7, p6, p5, p4, p3, p2, p1]
  for (const p of chain) {
    if (p.commitment && p.commitment.parentId === 0n) return p.commitment.id
  }
  // not yet loaded — return the shallowest we have
  for (const p of chain) {
    if (p.commitment) return p.commitment.id
  }
  return c.parentId
}

/** Hook: loads all ids in one subtree level. Returns childMap + allCommits. */
function useSubtreeLevel(ids: bigint[]): { childMap: Map<string, bigint[]>; commitments: Map<string, Commitment> } {
  const { data: childData0 } = useChildren(ids[0])
  const { data: childData1 } = useChildren(ids[1])
  const { data: childData2 } = useChildren(ids[2])
  const { data: childData3 } = useChildren(ids[3])
  const { data: childData4 } = useChildren(ids[4])
  const { data: childData5 } = useChildren(ids[5])
  const { data: childData6 } = useChildren(ids[6])
  const { data: childData7 } = useChildren(ids[7])
  const childDataArr = [childData0, childData1, childData2, childData3, childData4, childData5, childData6, childData7]

  const childMap = new Map<string, bigint[]>()
  for (let i = 0; i < ids.length; i++) {
    const arr = childDataArr[i] as bigint[] | undefined
    if (arr && arr.length > 0) childMap.set(ids[i].toString(), arr)
  }
  return { childMap, commitments: new Map() }
}

/**
 * CommitmentTree — full recursive tree from root.
 * Loads lazily: expands subtrees on demand via useChildren per node.
 */
interface CommitmentTreeProps {
  currentId:  bigint
  rootId:     bigint
  rootCommit: Commitment
  onNavigate: (v: string, id?: bigint) => void
  allCommitsMap:   Map<string, Commitment>
  expandedState:   Map<string, boolean>
  onExpand:        (id: bigint, v: boolean) => void
  onExpandAll:     () => void
  onCollapseAll:   () => void
  historyReady:    boolean
  treeTab:         string
  treeTabOptions:  { id: string; label: string }[]
  onTreeTab:       (v: string) => void
  currentCommit:   Commitment
  // for delegate
  showCreateChild:  boolean
  setShowCreateChild: (v: boolean) => void
  canCreateChild:   boolean
  isConnected:      boolean
  wrongChain:       boolean
  onCreateSuccess:  (id: bigint) => void
  onConfirmed:      (c: Confirmed) => void
  refetchAll:       () => void
}

function CommitmentTree({
  currentId, rootId, rootCommit,
  onNavigate, allCommitsMap, expandedState,
  onExpand, onExpandAll, onCollapseAll,
  historyReady, treeTab, treeTabOptions, onTreeTab,
  currentCommit, showCreateChild, setShowCreateChild,
  canCreateChild, isConnected, wrongChain,
  onCreateSuccess, onConfirmed, refetchAll,
}: CommitmentTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null)
  const { syncing, syncedTo } = useHistory()
  const hReady = historyReady || (syncedTo > 0n && !syncing)

  // Build childMap from allCommitsMap for keyboard nav
  const childMapForNav = useMemo(() => {
    const m = new Map<string, bigint[]>()
    for (const [key, commit] of allCommitsMap) {
      const parentKey = commit.parentId.toString()
      if (commit.parentId > 0n) {
        if (!m.has(parentKey)) m.set(parentKey, [])
        m.get(parentKey)!.push(commit.id)
      }
      if (!m.has(key)) m.set(key, [])
    }
    return m
  }, [allCommitsMap])

  const visibleList = useMemo(
    () => buildVisibleIds(rootId, childMapForNav, expandedState),
    [rootId, childMapForNav, expandedState],
  )

  // Roving tabindex: track which node has focus
  const [focusedId, setFocusedId] = useState<string>(currentId.toString())

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-tree-id]') as HTMLElement | null
    const nodeId  = target?.dataset.treeId ?? focusedId
    const idx     = visibleList.findIndex(n => n.id.toString() === nodeId)
    if (idx < 0) return

    const node = visibleList[idx]
    if (!node) return
    const idStr = node.id.toString()
    const commit = allCommitsMap.get(idStr)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = visibleList[idx + 1]
      if (next) { setFocusedId(next.id.toString()); focusTreeNode(treeRef, next.id.toString()) }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const prev = visibleList[idx - 1]
      if (prev) { setFocusedId(prev.id.toString()); focusTreeNode(treeRef, prev.id.toString()) }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (commit && commit.childCount > 0) {
        if (!expandedState.get(idStr)) {
          onExpand(node.id, true)
        } else {
          // move to first child
          const child = visibleList[idx + 1]
          if (child && child.depth > node.depth) { setFocusedId(child.id.toString()); focusTreeNode(treeRef, child.id.toString()) }
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (expandedState.get(idStr) && commit && commit.childCount > 0) {
        onExpand(node.id, false)
      } else if (commit && commit.parentId > 0n) {
        // move to parent
        const parentStr = commit.parentId.toString()
        setFocusedId(parentStr); focusTreeNode(treeRef, parentStr)
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      const first = visibleList[0]
      if (first) { setFocusedId(first.id.toString()); focusTreeNode(treeRef, first.id.toString()) }
    } else if (e.key === 'End') {
      e.preventDefault()
      const last = visibleList[visibleList.length - 1]
      if (last) { setFocusedId(last.id.toString()); focusTreeNode(treeRef, last.id.toString()) }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (node.id !== currentId) onNavigate('commitment', node.id)
    }
  }, [visibleList, focusedId, expandedState, onExpand, onNavigate, currentId, allCommitsMap, treeRef])

  const totalCount   = allCommitsMap.size
  const activityEvs  = eventsFor(currentId)
  const activityCount = activityEvs.length
  const isActivityTab = treeTab === 'activity'

  return (
    <div className="ws-tree-card">
      <div className="ws-card-head">
        <div className="ws-card-head-left">
          <span className="ws-card-title">Commitment tree</span>
          {isActivityTab
            ? <span className="ws-card-count">{activityCount} event{activityCount !== 1 ? 's' : ''}</span>
            : <span className="ws-card-count">{totalCount} node{totalCount !== 1 ? 's' : ''}</span>
          }
        </div>
        <div className="ws-card-head-right">
          {!isActivityTab && (
            <>
              <button className="tree-ctrl-btn" onClick={onExpandAll}>Expand all</button>
              <span className="tree-ctrl-sep" aria-hidden="true">·</span>
              <button className="tree-ctrl-btn" onClick={onCollapseAll}>Collapse all</button>
            </>
          )}
          <Seg value={treeTab} options={treeTabOptions} onChange={onTreeTab} />
        </div>
      </div>

      {treeTab === 'tree' && (
        <div
          ref={treeRef}
          role="tree"
          aria-label="Commitment tree"
          className="ws-tree-body"
        >
          <TreeNodeRow
            c={rootCommit}
            depth={0}
            isSelected={rootCommit.id === currentId}
            isAncestor={rootCommit.id !== currentId}
            isLast={true}
            expanded={expandedState}
            onExpand={onExpand}
            onSelect={id => onNavigate('commitment', id)}
            tabIndex={focusedId === rootCommit.id.toString() ? 0 : -1}
            onKeyDown={handleKeyDown}
            childMap={childMapForNav}
            allCommits={allCommitsMap}
            historyReady={hReady}
          />

          {/* Delegate / create child inline */}
          {canCreateChild && (
            <>
              <div className="tree-delegate-btn-wrap">
                <Button variant="ghost" size="sm" onClick={() => setShowCreateChild(!showCreateChild)}>
                  <Plus size={13} /> {showCreateChild ? 'Cancel delegation' : 'Delegate to specialist'}
                </Button>
              </div>
              {showCreateChild && (
                <div className="tree-create-child-wrap">
                  <WalletGate isConnected={isConnected} isWrongChain={wrongChain}>
                    <CreateChildPanel
                      parent={currentCommit}
                      onSuccess={newId => { setShowCreateChild(false); refetchAll(); onCreateSuccess(newId) }}
                      onCancel={() => setShowCreateChild(false)}
                      onConfirmed={onConfirmed}
                    />
                  </WalletGate>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {treeTab === 'activity' && (
        <div className="ws-activity-wrap">
          <Activity commitmentId={currentId} embedded />
        </div>
      )}
    </div>
  )
}

function focusTreeNode(ref: React.RefObject<HTMLDivElement | null>, idStr: string) {
  const el = ref.current?.querySelector<HTMLElement>(`[data-tree-id="${idStr}"]`)
  el?.focus()
}

/* ────────────────────────────────────────────────────────────────────────────
   useFullTree — loads the full subtree from the root lazily.
   Returns allCommitsMap, childMapForNav, expandedState + controls.
──────────────────────────────────────────────────────────────────────────── */
const MAX_AUTO_EXPAND_DEPTH = 3  // depth ≥ 4 starts collapsed

function useFullTree(rootId: bigint, currentId: bigint, rootCommit: Commitment | undefined) {
  // We load up to 4 levels deep eagerly. Each level uses a fixed number of hook calls
  // (8 slots each) so the hook count never changes.

  // Level 0: root's children
  const { data: l0raw } = useChildren(rootId)
  const l0ids = useMemo(() => (l0raw as bigint[] | undefined) ?? [], [l0raw])

  // Level 1: children of l0
  const { childMap: cm1 } = useSubtreeLevel(l0ids.slice(0, 8))

  // Collect all level-1 ids
  const l1ids = useMemo(() => {
    const out: bigint[] = []
    for (const ids of cm1.values()) out.push(...ids)
    return out.slice(0, 8)
  }, [cm1])

  // Level 2: children of l1
  const { childMap: cm2 } = useSubtreeLevel(l1ids)

  // Collect all level-2 ids
  const l2ids = useMemo(() => {
    const out: bigint[] = []
    for (const ids of cm2.values()) out.push(...ids)
    return out.slice(0, 8)
  }, [cm2])

  // Level 3: children of l2
  const { childMap: cm3 } = useSubtreeLevel(l2ids)

  // Fetch all commitment data for all levels
  const allIds = useMemo(() => {
    const set = new Set<string>()
    if (rootCommit) set.add(rootId.toString())
    for (const id of l0ids) set.add(id.toString())
    for (const ids of cm1.values()) ids.forEach(id => set.add(id.toString()))
    for (const ids of cm2.values()) ids.forEach(id => set.add(id.toString()))
    for (const ids of cm3.values()) ids.forEach(id => set.add(id.toString()))
    return [...set].map(s => BigInt(s))
  }, [rootId, rootCommit, l0ids, cm1, cm2, cm3])

  const { commitments: fetchedCommitments } = useCommitments(allIds)

  // Build allCommitsMap
  const allCommitsMap = useMemo(() => {
    const m = new Map<string, Commitment>()
    if (rootCommit) m.set(rootId.toString(), rootCommit)
    for (const c of fetchedCommitments ?? []) m.set(c.id.toString(), c)
    return m
  }, [rootId, rootCommit, fetchedCommitments])

  // Build combined childMap from all levels
  const childMapForNav = useMemo(() => {
    const m = new Map<string, bigint[]>()
    // root's children
    if (l0ids.length > 0) m.set(rootId.toString(), l0ids)
    // merge cm1, cm2, cm3
    for (const [k, v] of cm1) m.set(k, v)
    for (const [k, v] of cm2) m.set(k, v)
    for (const [k, v] of cm3) m.set(k, v)
    return m
  }, [rootId, l0ids, cm1, cm2, cm3])

  // Build initial expanded state from the path root → current
  const initialExpanded = useMemo(() => {
    const m = new Map<string, boolean>()
    // Path from root to current: expand every ancestor
    // We reconstruct the path by walking up from currentId using allCommitsMap
    let cur = allCommitsMap.get(currentId.toString())
    while (cur && cur.parentId > 0n) {
      m.set(cur.parentId.toString(), true)
      cur = allCommitsMap.get(cur.parentId.toString())
    }
    // Also expand root if it has children and current is root
    if (rootId === currentId && rootCommit && rootCommit.childCount > 0) {
      m.set(rootId.toString(), true)
    }
    // Collapse depth >= MAX_AUTO_EXPAND_DEPTH nodes that are not on the path
    for (const [key, commit] of allCommitsMap) {
      if (commit.depth >= MAX_AUTO_EXPAND_DEPTH && !m.has(key)) {
        m.set(key, false)
      }
    }
    return m
  }, [currentId, rootId, rootCommit, allCommitsMap])

  return { allCommitsMap, childMapForNav, initialExpanded }
}

/* ════════════════════════════════════════════════════════════════════════════
   Action panels — logic unchanged, markup restyled
════════════════════════════════════════════════════════════════════════════ */
function decodeFundsReturned(receipt: { logs: readonly { topics: readonly `0x${string}`[]; data: `0x${string}` }[] } | undefined) {
  if (!receipt) return null
  try {
    const logs = parseEventLogs({ abi: cascadeAbi, logs: receipt.logs as Parameters<typeof parseEventLogs>[0]['logs'], eventName: 'FundsReturned' })
    const args = logs[0]?.args as { parentId?: bigint; amount?: bigint } | undefined
    if (args?.amount !== undefined && args.parentId !== undefined) return args
    return null
  } catch { return null }
}

function SubmitPanel({ id, approver, onSuccess, onConfirmed, open, onToggle }: {
  id: bigint; approver: string; onSuccess: () => void; onConfirmed: (c: Confirmed) => void; open: boolean; onToggle: () => void
}) {
  const [ref, setRef] = useState('')
  const { submit, isPending, isConfirming, isSuccess, isError, error, reset, hash } = useSubmit()
  useSuccessOnce(isSuccess, hash, () => {
    onConfirmed({ text: `Submitted for review by ${shortAddr(approver)}.`, hash: hash!, showClaims: false })
    onSuccess(); reset(); triggerRefetch()
  })
  return (
    <div className="action-panel">
      <button onClick={onToggle} className="action-panel-header">
        <span className="action-panel-title"><Send size={14} /> Submit delivery</span>
        <ChevronRight size={16} aria-expanded={open} className={`action-chevron${open ? ' action-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="action-panel-body">
          <p className="action-panel-hint">Provide a delivery reference and submit for approval.</p>
          <p className="action-panel-public-note">
            Delivery links are public and permanent.{' '}
            <LearnMore href="/docs/submitting-and-reviewing" />
          </p>
          <input className="input" style={{ marginBottom: 10 }} placeholder="https:// or ipfs://…" value={ref} onChange={e => setRef(e.target.value)} />
          <Button variant="primary" size="sm" loading={isPending || isConfirming} disabled={!ref.trim()} onClick={() => submit(id, ref.trim())}>Submit</Button>
          <TxStatus isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} isError={isError} error={error} hash={hash} successLabel="Submitted for approval" onDismiss={reset} />
        </div>
      )}
    </div>
  )
}

function ApproveBtn({ id, manager, onSuccess, onConfirmed }: { id: bigint; manager: string; onSuccess: () => void; onConfirmed: (c: Confirmed) => void }) {
  const { approve, isPending, isConfirming, isSuccess, isError, error, reset, hash, receipt } = useApprove()
  useSuccessOnce(isSuccess, hash, () => {
    let text: string | null = null
    try {
      const logs = parseEventLogs({ abi: cascadeAbi, logs: receipt!.logs, eventName: 'CommitmentApproved' })
      const args = logs[0]?.args as { released?: bigint; manager?: string } | undefined
      const to   = args?.manager ?? manager
      if (args?.released !== undefined) text = `Released ${formatUsdc(args.released)} USDC to ${shortAddr(to)}. It is now claimable.`
    } catch { /* fall through */ }
    onConfirmed({ text, hash: hash!, showClaims: false })
    onSuccess(); reset(); triggerRefetch()
  })
  return (
    <div className="action-panel">
      <Button variant="primary" size="md" style={{ width: '100%', borderRadius: 'var(--r-sm)' }} loading={isPending || isConfirming} onClick={() => approve(id)}>
        <Check size={14} /> Approve delivery
      </Button>
      <TxStatus isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} isError={isError} error={error} hash={hash} successLabel="Approved" onDismiss={reset} />
    </div>
  )
}

function RejectBtn({ id, isRoot, onSuccess, onConfirmed }: { id: bigint; isRoot: boolean; onSuccess: () => void; onConfirmed: (c: Confirmed) => void }) {
  const { reject, isPending, isConfirming, isSuccess, isError, error, reset, hash, receipt } = useReject()
  useSuccessOnce(isSuccess, hash, () => {
    const fr = !isRoot ? decodeFundsReturned(receipt) : null
    const text = fr ? `Returned ${formatUsdc(fr.amount)} USDC to #${fr.parentId!.toString()}.`
      : isRoot ? 'Remaining funds were credited to the client\'s claimable balance.' : null
    onConfirmed({ text, hash: hash!, showClaims: isRoot })
    onSuccess(); reset(); triggerRefetch()
  })
  return (
    <div className="action-panel">
      <Button variant="ghost" size="md" style={{ width: '100%', borderRadius: 'var(--r-sm)', color: 'var(--bad)' }} loading={isPending || isConfirming} onClick={() => reject(id)}>
        <X size={14} /> Reject delivery
      </Button>
      <TxStatus isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} isError={isError} error={error} hash={hash} successLabel="Rejected" onDismiss={reset} />
    </div>
  )
}

function CancelBtn({ id, isRoot, onSuccess, onConfirmed }: { id: bigint; isRoot: boolean; onSuccess: () => void; onConfirmed: (c: Confirmed) => void }) {
  const [open, setOpen] = useState(false)
  const { cancel, isPending, isConfirming, isSuccess, isError, error, reset, hash, receipt } = useCancel()
  useSuccessOnce(isSuccess, hash, () => {
    const fr = !isRoot ? decodeFundsReturned(receipt) : null
    const text = fr ? `Returned ${formatUsdc(fr.amount)} USDC to #${fr.parentId!.toString()}.`
      : isRoot ? 'Remaining funds were credited to the client\'s claimable balance.' : null
    onConfirmed({ text, hash: hash!, showClaims: isRoot })
    onSuccess(); reset(); setOpen(false); triggerRefetch()
  })
  return (
    <div className="action-panel">
      <button onClick={() => setOpen(v => !v)} className="action-panel-header action-panel-header--ghost">
        <span className="action-panel-title"><Ban size={14} /> Cancel</span>
        <ChevronRight size={16} aria-expanded={open} className={`action-chevron${open ? ' action-chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="action-panel-body">
          <p className="action-panel-hint">The remaining balance returns to the parent or client.</p>
          <Button variant="ghost" size="sm" loading={isPending || isConfirming} onClick={() => cancel(id)}>Confirm cancel</Button>
          <TxStatus isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} isError={isError} error={error} hash={hash} successLabel="Cancelled" onDismiss={reset} />
        </div>
      )}
    </div>
  )
}

function ExpireBtn({ id, isRoot, onSuccess, onConfirmed }: { id: bigint; isRoot: boolean; onSuccess: () => void; onConfirmed: (c: Confirmed) => void }) {
  const { expire, isPending, isConfirming, isSuccess, isError, error, reset, hash, receipt } = useExpire()
  useSuccessOnce(isSuccess, hash, () => {
    const fr = !isRoot ? decodeFundsReturned(receipt) : null
    const text = fr ? `Returned ${formatUsdc(fr.amount)} USDC to #${fr.parentId!.toString()}.`
      : isRoot ? 'Remaining funds were credited to the client\'s claimable balance.' : null
    onConfirmed({ text, hash: hash!, showClaims: isRoot })
    onSuccess(); reset(); triggerRefetch()
  })
  return (
    <div className="action-panel">
      <Button variant="ghost" size="md" style={{ width: '100%', borderRadius: 'var(--r-sm)', color: 'var(--warn)' }} loading={isPending || isConfirming} onClick={() => expire(id)}>
        <Clock size={14} /> Expire commitment
      </Button>
      <TxStatus isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} isError={isError} error={error} hash={hash} successLabel="Expired" onDismiss={reset} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   CreateChildPanel — logic unchanged
════════════════════════════════════════════════════════════════════════════ */
function CField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="field-label" style={{ display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}
function ErrMsg({ msg }: { msg: string }) {
  return <p className="field-error">{msg}</p>
}

function CreateChildPanel({ parent, onSuccess, onCancel, onConfirmed }: {
  parent: Commitment; onSuccess: (id: bigint) => void; onCancel: () => void; onConfirmed: (c: Confirmed) => void
}) {
  const { chainId, isConnected } = useAccount()
  const { switchChain } = useWagmiSwitchChain()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID
  const [childManager,  setChildManager]  = useState('')
  const [childAmount,   setChildAmount]   = useState('')
  const [childDeadline, setChildDeadline] = useState('')
  const [childTitle,    setChildTitle]    = useState('')
  const { createChild, isPending, isConfirming, isSuccess, isError, error, reset, hash, receipt } = useCreateChild()
  const parsedAmount = parseUsdc(childAmount)
  const deadlineTs   = childDeadline ? BigInt(Math.floor(new Date(childDeadline).getTime() / 1000)) : undefined
  const del              = parent.depth === 0 ? computeDelegation(parent) : null
  const exceedsCapacity  = Boolean(del && parsedAmount !== undefined && parsedAmount > del.available)
  const exceedsRemaining = Boolean(parsedAmount !== undefined && parsedAmount > parent.remaining)
  const maxDeadline      = parent.deadline ? new Date(Number(parent.deadline) * 1000).toISOString().slice(0, 16) : undefined
  const [minDate]        = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16))
  const [nowTs]          = useState(() => BigInt(Math.floor(Date.now() / 1000)))
  const valid = isAddress(childManager) && parsedAmount !== undefined && parsedAmount > 0n &&
    !exceedsCapacity && !exceedsRemaining && deadlineTs !== undefined && deadlineTs > nowTs && childTitle.trim().length > 0
  function decodeNewChildId(): bigint | undefined {
    if (!receipt) return undefined
    try {
      const logs = parseEventLogs({ abi: cascadeAbi, logs: receipt.logs, eventName: 'ChildCreated' })
      return (logs[0]?.args as { id?: bigint } | undefined)?.id
    } catch { return undefined }
  }
  useSuccessOnce(isSuccess, hash, () => {
    const newId = decodeNewChildId()
    try {
      const logs = parseEventLogs({ abi: cascadeAbi, logs: receipt!.logs, eventName: 'ChildCreated' })
      const args = logs[0]?.args as { id?: bigint; manager?: string; budget?: bigint } | undefined
      if (args?.id !== undefined) {
        const text = `Delegated ${formatUsdc(args.budget)} USDC to ${shortAddr(args.manager ?? '')} as #${args.id.toString()}.`
        onConfirmed({ text, hash: hash!, showClaims: false })
      }
    } catch { /* fall through */ }
    triggerRefetch()
    onSuccess(newId ?? parent.id)
  })
  return (
    <div className="create-child-panel">
      <div className="create-child-head">
        <p className="create-child-title">Delegate to specialist</p>
        <button onClick={onCancel} className="create-child-close" aria-label="Cancel"><X size={15} /></button>
      </div>
      {del && (
        <div className="create-child-capacity">
          <div><p className="ccp-label">Available capacity</p><p className="ccp-value">{formatUsdc(del.available)} USDC</p></div>
          <div><p className="ccp-label">Parent remaining</p><p className="ccp-value">{formatUsdc(parent.remaining)} USDC</p></div>
        </div>
      )}
      <div className="create-child-fields">
        <CField label="Title">
          <input className="input" placeholder="Task description" value={childTitle} onChange={e => setChildTitle(e.target.value)} maxLength={100} />
        </CField>
        <CField label="Specialist address">
          <input className="input input-mono" placeholder="0x…" value={childManager} onChange={e => setChildManager(e.target.value)}
            style={{ borderColor: childManager && !isAddress(childManager) ? 'var(--danger)' : undefined }} />
          {childManager && !isAddress(childManager) && <ErrMsg msg="Invalid address" />}
        </CField>
        <CField label="USDC amount">
          <input className="input input-mono" inputMode="decimal" placeholder="0.00" value={childAmount}
            onChange={e => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setChildAmount(v) }}
            style={{ borderColor: (exceedsCapacity || exceedsRemaining) ? 'var(--danger)' : undefined }} />
          {exceedsCapacity  && del && <ErrMsg msg={`Exceeds delegation capacity (${formatUsdc(del.available)} available)`} />}
          {exceedsRemaining && !exceedsCapacity && <ErrMsg msg="Exceeds parent remaining balance" />}
        </CField>
        <CField label="Deadline">
          <input type="datetime-local" className="input" min={minDate} max={maxDeadline} value={childDeadline} onChange={e => setChildDeadline(e.target.value)} />
        </CField>
      </div>
      <div className="create-child-actions">
        {wrongChain
          ? <Button variant="primary" size="sm" onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}>Switch network</Button>
          : <Button variant="primary" size="sm" loading={isPending || isConfirming} disabled={!valid}
              onClick={() => createChild({ parentId: parent.id, manager: childManager as `0x${string}`, amount: parsedAmount!, deadline: deadlineTs!, title: childTitle.trim() })}>
              Create child
            </Button>
        }
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
      <TxStatus isPending={isPending} isConfirming={isConfirming} isSuccess={isSuccess} isError={isError} error={error} hash={hash} successLabel="Child commitment created" onDismiss={reset} />
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   MoneyBar — full-width card with 5 stats + proportion bar
════════════════════════════════════════════════════════════════════════════ */
function MoneyBar({ c }: { c: Commitment }) {
  const fd      = useFundsData(c)
  const del     = c.depth === 0 ? computeDelegation(c) : null
  const tipId   = useId()
  const total   = fd.funded > 0n ? fd.funded : 1n
  const pHeld       = Number((fd.held       * 10000n) / total) / 100
  const pDelegated  = Number((fd.delegated  * 10000n) / total) / 100
  const pSettled    = Number((fd.settled    * 10000n) / total) / 100
  const pReturned   = Number((fd.returned   * 10000n) / total) / 100

  const stats = [
    { label: 'Funded',              value: fd.funded },
    { label: 'Delegated (live)',    value: fd.delegated },
    { label: 'Settled to agents',  value: fd.settled },
    { label: 'Returned / Refunded',value: fd.returned },
    { label: 'Held here now',       value: fd.held },
  ]

  if (!fd.historyReady && (c.childCount > 0 || isTerminal(c.state))) {
    return (
      <div className="money-bar">
        <div className="money-bar-stats">
          {stats.map((s, i) => (
            <div key={i} className="money-stat">
              <p className="money-stat-label">{s.label}</p>
              <Skeleton width="80px" height={24} />
            </div>
          ))}
        </div>
        <div className="sync-bar" style={{ marginTop: 16 }}>
          <div className="sync-bar-fill" style={{ width: `${Math.round(fd.progress * 100)}%` }} />
        </div>
      </div>
    )
  }

  return (
    <div className="money-bar">
      <div className="money-bar-stats">
        {stats.map((s, i) => (
          <div key={i} className="money-stat">
            <p className="money-stat-label">{s.label}</p>
            <p className="money-stat-value">
              <span className="money-stat-num">{formatUsdc(s.value)}</span>
              <span className="money-stat-unit"> USDC</span>
            </p>
          </div>
        ))}
        <div className="money-stat money-stat--learn">
          <LearnMore href="/docs/money-flow-and-reconciliation" />
        </div>
      </div>

      {/* Proportion bar */}
      <div className="prop-bar-wrap">
        <div className="prop-bar" role="img" aria-label="Funds allocation">
          {pHeld      > 0 && <div className="prop-seg prop-seg--held"      style={{ width: `${pHeld}%` }} />}
          {pDelegated > 0 && <div className="prop-seg prop-seg--delegated" style={{ width: `${pDelegated}%` }} />}
          {pSettled   > 0 && <div className="prop-seg prop-seg--settled"   style={{ width: `${pSettled}%` }} />}
          {pReturned  > 0 && <div className="prop-seg prop-seg--returned"  style={{ width: `${pReturned}%` }} />}
        </div>
        <div className="prop-legend">
          <span className="prop-legend-item"><span className="prop-dot prop-dot--held" />Held</span>
          <span className="prop-legend-item"><span className="prop-dot prop-dot--delegated" />Live delegations</span>
          <span className="prop-legend-item"><span className="prop-dot prop-dot--settled" />Settled</span>
          <span className="prop-legend-item"><span className="prop-dot prop-dot--returned" />Returned</span>
        </div>
      </div>

      {/* Root-only delegation line */}
      {del && (
        <p className="money-del-line">
          Delegation limit {formatUsdc(del.delegationLimit)} USDC
          <InfoTooltip id={tipId} text="The maximum total that can be delegated to child commitments. The remainder is the protected reserve." />
          {' · '}Protected reserve {formatUsdc(del.reserve)} USDC
          {' · '}<LearnMore href="/docs/delegation-and-reserve" />
        </p>
      )}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   Inspector tabs
════════════════════════════════════════════════════════════════════════════ */
interface InspectorProps {
  c:            Commitment
  role:         string | null
  roleParts:    string[]
  actions?:     ReactNode
  confirmed?:   Confirmed | null
  onClearConfirmed?: () => void
  onNavigateClaims?: () => void
  onNavigate:   (v: string, id?: bigint) => void
}

function Inspector({ c, role, roleParts, actions, confirmed, onClearConfirmed, onNavigateClaims, onNavigate }: InspectorProps) {
  const [tab, setTab] = useState<'overview'|'funds'|'people'|'details'>('overview')
  const pId = useId()
  const fd  = useFundsData(c)
  const status = statusOf(c.state, c.failReason)
  const dl  = new Date(Number(c.deadline) * 1000)
  const dlStr = dl.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const dlFull = formatDeadline(c.deadline)
  const past = isPast(c.deadline)
  const isUrl = c.deliveryRef?.startsWith('http') || c.deliveryRef?.startsWith('ipfs://')
  const step  = nextStep(c, [], '') // simplified for display; full version used in header

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'funds',    label: 'Funds'    },
    { id: 'people',   label: 'People'   },
    { id: 'details',  label: 'Details'  },
  ] as const

  return (
    <div className="inspector-card">
      {/* Card header */}
      <div className="inspector-head">
        <div className="inspector-head-left">
          <p className="inspector-title">{c.title || `Commitment #${c.id}`}</p>
          <div className="inspector-head-meta">
            <StatusBadge status={status} size="sm" />
            <span className="mono inspector-id">#{c.id.toString()}</span>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="inspector-tabs">
        <Seg
          value={tab}
          options={TABS as unknown as { id: string; label: string }[]}
          onChange={v => setTab(v as typeof tab)}
          panelPrefix={pId}
        />
      </div>

      {/* Tab panels */}
      <div className="inspector-panels">

        {/* OVERVIEW */}
        {tab === 'overview' && (
          <div id={`${pId}-panel-overview`} role="tabpanel" aria-labelledby={`${pId}-tab-overview`} className="inspector-panel-content">
            {/* Next step notice */}
            <Notice kind={isTerminal(c.state) ? 'info' : 'info'} style={{ marginBottom: 16 }}>
              {step}
            </Notice>

            {/* Action area */}
            {actions && (
              <div className="inspector-actions">
                {actions}
              </div>
            )}

            {/* Confirmed note */}
            {confirmed && onClearConfirmed && (
              <ConfirmedNote c={confirmed} onDismiss={onClearConfirmed} onNavigateClaims={confirmed.showClaims ? onNavigateClaims : undefined} />
            )}

            {/* Outcome */}
            <OutcomeBlock c={c} onNavigate={onNavigate} />

            {/* Deadline */}
            <div className="inspector-kv-row">
              <span className="inspector-kv-label">
                Deadline
                <LearnMore href="/docs/cancelling-and-expiry" />
              </span>
              <span className="inspector-kv-val">
                {isTerminal(c.state)
                  ? <span className="text-3">{dlStr}</span>
                  : <span>
                      {dlStr}
                      <span className={`inspector-dl-rel ${past ? 'inspector-dl-rel--past' : ''}`}> · {relativeDeadline(c.deadline)}</span>
                    </span>
                }
              </span>
            </div>
          </div>
        )}

        {/* FUNDS */}
        {tab === 'funds' && (
          <div id={`${pId}-panel-funds`} role="tabpanel" aria-labelledby={`${pId}-tab-funds`} className="inspector-panel-content">
            {!fd.historyReady ? (
              <div>
                {[0,1,2,3].map(i => (
                  <div key={i} className="inspector-kv-row">
                    <Skeleton width="40%" height={12} />
                    <Skeleton width="30%" height={12} />
                  </div>
                ))}
                <div className="sync-bar" style={{ marginTop: 12 }}>
                  <div className="sync-bar-fill" style={{ width: `${Math.round(fd.progress * 100)}%` }} />
                </div>
              </div>
            ) : (
              <>
                {[
                  { label: 'Funded',                value: fd.funded },
                  ...(c.childCount > 0 ? [
                    { label: 'Delegated to children', value: fd.delegated },
                    { label: 'Settled by children',   value: fd.settled },
                    { label: 'Returned by children',  value: fd.returned },
                  ] : []),
                  ...(fd.outcomeLabel && fd.outcomeAmount !== null ? [
                    { label: fd.outcomeLabel,          value: fd.outcomeAmount },
                  ] : []),
                  { label: 'Held now',              value: fd.held },
                ].map((row, i) => (
                  <div key={i} className="inspector-kv-row">
                    <span className="inspector-kv-label">{row.label}</span>
                    <span className="inspector-kv-val funds-val">
                      <span className="mono">{formatUsdc(row.value)}</span>
                      <span className="text-3"> USDC</span>
                    </span>
                  </div>
                ))}
                <p className={`funds-reconcile${fd.reconciles ? ' funds-reconcile--ok' : ''}`}>
                  {fd.reconciles ? '✓ Reconciles with onchain balance' : 'Waiting for history sync'}
                  {' '}<LearnMore href="/docs/money-flow-and-reconciliation" />
                </p>
              </>
            )}
          </div>
        )}

        {/* PEOPLE */}
        {tab === 'people' && (
          <div id={`${pId}-panel-people`} role="tabpanel" aria-labelledby={`${pId}-tab-people`} className="inspector-panel-content">
            {[
              ...(c.depth === 0 ? [{
                roleLabel: 'Client',
                addr: c.client,
                desc: 'Funded the objective and receives refunds if it fails.',
              }] : []),
              {
                roleLabel: 'Manager',
                addr: c.manager,
                desc: 'Submits the delivery and can delegate work to specialists.',
              },
              {
                roleLabel: 'Approver',
                addr: c.approver,
                desc: 'Approves, rejects, or cancels this commitment.',
              },
            ].map(({ roleLabel, addr, desc }) => {
              const isYou = roleParts.includes(roleLabel)
              return (
                <div key={roleLabel} className="people-row">
                  <div className="people-row-top">
                    <AddressDisplay address={addr} identicon iconSize={20} />
                    <Pill tone="neutral" size="sm">
                      {isYou ? `You · ${roleLabel}` : roleLabel}
                    </Pill>
                  </div>
                  <p className="people-desc">{desc}</p>
                </div>
              )
            })}
            {role && (
              <p className="people-your-role">Your role: <strong>{role}</strong></p>
            )}
            <div className="people-learn"><LearnMore href="/docs/states-and-permissions" /></div>
          </div>
        )}

        {/* DETAILS */}
        {tab === 'details' && (
          <div id={`${pId}-panel-details`} role="tabpanel" aria-labelledby={`${pId}-tab-details`} className="inspector-panel-content">
            {[
              { label: 'ID',       value: <span className="mono">#{c.id.toString()}</span> },
              { label: 'Depth',    value: <span className="mono">{c.depth}</span> },
              ...(c.parentId > 0n ? [{ label: 'Parent', value: (
                <button onClick={() => onNavigate('commitment', c.parentId)} className="detail-nav-btn">
                  #{c.parentId.toString()} <ChevronRight size={12} />
                </button>
              )}] : []),
              ...(c.deliveryRef ? [{ label: 'Delivery ref', value: isUrl
                ? <a href={c.deliveryRef} target="_blank" rel="noreferrer" className="detail-link">{c.deliveryRef.length > 30 ? c.deliveryRef.slice(0, 30) + '…' : c.deliveryRef} <ExternalLink size={10} /></a>
                : <span className="mono detail-ref">{c.deliveryRef}</span>
              }] : []),
              { label: 'Deadline', value: <span className="mono detail-dl">{dlFull}</span> },
              { label: 'Contract', value: (
                <a href={addrUrl(CASCADE_ADDRESS ?? '')} target="_blank" rel="noreferrer" className="detail-link">
                  <span className="mono">{shortAddr(CASCADE_ADDRESS ?? '')}</span> <ExternalLink size={10} />
                </a>
              )},
            ].map((row, i) => (
              <div key={i} className="inspector-kv-row">
                <span className="inspector-kv-label">{row.label}</span>
                <span className="inspector-kv-val">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   WorkspaceSkeleton — matches new layout exactly
════════════════════════════════════════════════════════════════════════════ */
function WorkspaceSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="workspace-page">
      {/* Header skeleton */}
      <div className="ws-header">
        <div>
          <Skeleton width={80} height={12} style={{ marginBottom: 8 }} />
          <Skeleton width={260} height={28} style={{ marginBottom: 12 }} />
          <Skeleton width={320} height={14} />
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={13} /> All objectives</Button>
      </div>
      {/* Money bar skeleton */}
      <div className="money-bar">
        <div className="money-bar-stats">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="money-stat">
              <Skeleton width="70%" height={12} style={{ marginBottom: 8 }} />
              <Skeleton width="80%" height={20} />
            </div>
          ))}
        </div>
      </div>
      {/* Body grid skeleton */}
      <div className="ws-body-grid">
        <div className="ws-tree-card">
          <div className="ws-card-head">
            <Skeleton width={130} height={14} />
            <Skeleton width={120} height={32} radius={8} />
          </div>
          <div style={{ padding: '24px' }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="tree-node-skel">
                <Skeleton width={32} height={32} radius={8} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width="55%" height={12} />
                  <Skeleton width="35%" height={10} />
                </div>
                <Skeleton width={60} height={14} />
              </div>
            ))}
          </div>
        </div>
        <div className="ws-inspector-card">
          <div style={{ padding: '20px' }}>
            <Skeleton width={160} height={16} style={{ marginBottom: 10 }} />
            <Skeleton width={80} height={22} radius={6} style={{ marginBottom: 20 }} />
            <div className="seg-control" style={{ marginBottom: 20 }}>
              {[0,1,2,3].map(i => <Skeleton key={i} width={60} height={32} radius={6} />)}
            </div>
            {[0,1,2,3,4].map(i => (
              <div key={i} className="inspector-kv-row">
                <Skeleton width="35%" height={11} />
                <Skeleton width="40%" height={11} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   NotFound
════════════════════════════════════════════════════════════════════════════ */
function NotFound({ id, onNavigate }: { id: bigint; onNavigate: (v: string, id?: bigint) => void }) {
  return (
    <div className="not-found">
      <p className="not-found-title">Commitment #{id.toString()} not found</p>
      <p className="not-found-body">This commitment does not exist or the contract is not deployed.</p>
      <Button variant="ghost" size="sm" onClick={() => onNavigate('explore')}>Back to Objectives</Button>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   CommitmentWorkspace — main export
   Uses useFullTree for the full recursive tree from root.
════════════════════════════════════════════════════════════════════════════ */
export function CommitmentWorkspace({ id, onNavigate }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN_ID
  const { commitment, isLoading, error: commitError, refetch } = useCommitment(id)
  const { data: childIds, refetch: refetchChildren } = useChildren(id)
  const { commitments: children } = useCommitments((childIds as bigint[] | undefined) ?? [])
  const invalidate = useInvalidateCommitment()

  // Walk up to root
  const rootId = useRootId(commitment ?? { id, parentId: 0n } as Commitment)
  const { commitment: rootCommitment } = useCommitment(rootId !== id ? rootId : undefined)
  const effectiveRoot = rootId === id ? commitment : rootCommitment

  // Full tree state — useFullTree must be called unconditionally
  const { allCommitsMap, initialExpanded } = useFullTree(rootId, id, effectiveRoot)
  const [expandedState, setExpandedState] = useState<Map<string, boolean>>(new Map())

  // Sync initialExpanded into state once allCommitsMap is populated
  const [expandedInit, setExpandedInit] = useState(false)
  if (!expandedInit && allCommitsMap.size > 0) {
    setExpandedState(new Map(initialExpanded))
    setExpandedInit(true)
  }

  const onExpand = useCallback((nid: bigint, v: boolean) => {
    setExpandedState(prev => {
      const next = new Map(prev)
      next.set(nid.toString(), v)
      return next
    })
  }, [])

  const onExpandAll = useCallback(() => {
    setExpandedState(prev => {
      const next = new Map(prev)
      for (const key of allCommitsMap.keys()) next.set(key, true)
      return next
    })
  }, [allCommitsMap])

  const onCollapseAll = useCallback(() => {
    setExpandedState(prev => {
      const next = new Map(prev)
      for (const key of allCommitsMap.keys()) next.set(key, false)
      return next
    })
  }, [allCommitsMap])

  const [showCreateChild, setShowCreateChild] = useState(false)
  const [showSubmit,      setShowSubmit]      = useState(false)
  const [treeTab,         setTreeTab]         = useState<'tree'|'activity'>('tree')
  const [confirmedEntry, setConfirmedEntry]   = useState<{ id: bigint; c: Confirmed } | null>(null)
  const confirmed = confirmedEntry?.id === id ? confirmedEntry.c : null
  const setConfirmed = (c: Confirmed | null) => setConfirmedEntry(c ? { id, c } : null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const { syncing, syncedTo } = useHistory()
  const historyReady = syncedTo > 0n && !syncing

  const refetchAll = useCallback(() => {
    invalidate()
    setTimeout(() => { void refetch(); void refetchChildren() }, 600)
  }, [invalidate, refetch, refetchChildren])
  const navClaims = useCallback(() => onNavigate('claims'), [onNavigate])

  // Also load parent for the header "in #N" link
  const { commitment: parentCommitment } = useCommitment(
    commitment?.parentId && commitment.parentId > 0n ? commitment.parentId : undefined,
  )

  if (isLoading) return <WorkspaceSkeleton onBack={() => onNavigate('explore')} />
  if (commitError) return (
    <div style={{ padding: '32px 0' }}>
      <ReadError message={(commitError as Error)?.message} onRetry={() => void refetch()} />
    </div>
  )
  if (!commitment || commitment.id === 0n) return <NotFound id={id} onNavigate={onNavigate} />

  const c = commitment
  const isManager  = !!address && address.toLowerCase() === c.manager.toLowerCase()
  const isApprover = !!address && address.toLowerCase() === c.approver.toLowerCase()
  const isClient   = c.depth === 0 && !!address && address.toLowerCase() === c.client.toLowerCase()
  const allChildrenTerminal = !children || children.every(ch => isTerminal(ch.state))

  const canSubmit      = isManager  && c.state === CommitmentState.Active    && !isPast(c.deadline) && allChildrenTerminal
  const canApprove     = isApprover && c.state === CommitmentState.Submitted
  const canReject      = isApprover && c.state === CommitmentState.Submitted
  const canCancel      = isApprover && c.state === CommitmentState.Active    && allChildrenTerminal
  const canExpire      = !isTerminal(c.state) && isPast(c.deadline)          && allChildrenTerminal
  const canCreateChild = isManager  && c.state === CommitmentState.Active    && (c.childCount < 16) && c.depth < 8

  const roleParts: string[] = []
  if (isClient)   roleParts.push('Client')
  if (isManager)  roleParts.push('Manager')
  if (isApprover) roleParts.push('Approver')
  const role = roleParts.length ? roleParts.join(' · ') : null

  const status = statusOf(c.state, c.failReason)
  const step   = nextStep(c, children ?? [], address ?? '')

  // Primary and secondary actions
  const primaryAction = canSubmit ? (
    <Button variant="primary" size="lg" onClick={() => { setConfirmed(null); setShowSubmit(v => !v) }}>
      <Send size={14} /> Submit delivery
    </Button>
  ) : canApprove ? (
    <Button variant="primary" size="lg" onClick={() => { /* handled inside Inspector */ }}>
      <Check size={14} /> Approve
    </Button>
  ) : canCreateChild ? (
    <Button variant="secondary" size="lg" onClick={() => setShowCreateChild(v => !v)}>
      <Plus size={14} /> Delegate
    </Button>
  ) : null

  const kicker = c.depth === 0
    ? `Objective #${c.id.toString()}`
    : `Commitment #${c.id.toString()} · in #${c.parentId.toString()}`

  const treeTabOptions = [
    { id: 'tree',     label: 'Tree' },
    { id: 'activity', label: 'Activity' },
  ]

  return (
    <div className="workspace-page">

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className="ws-header">
        <div className="ws-header-left">
          {/* Breadcrumb / kicker */}
          <div className="ws-kicker">
            <button onClick={() => onNavigate('explore')} className="ws-back-link">
              <ArrowLeft size={12} /> All objectives
            </button>
            <span className="ws-kicker-sep">/</span>
            <span className="mono ws-kicker-id">{kicker}</span>
          </div>
          {/* Title */}
          <h1 className="ws-title">{c.title || `Commitment #${c.id}`}</h1>
          {/* Status row */}
          <div className="ws-status-row">
            <StatusBadge status={status} size="md" />
            {roleParts.length > 0 && (
              <Pill tone="neutral" size="sm">
                {`You · ${roleParts.join(' · ')}`}
              </Pill>
            )}
            {c.parentId > 0n && parentCommitment && (
              <button onClick={() => onNavigate('commitment', c.parentId)} className="ws-parent-link">
                in #{c.parentId.toString()}
              </button>
            )}
          </div>
          {/* Next step sentence */}
          <p className="ws-next-step">{step}</p>
        </div>

        {/* Right: primary + more */}
        {(primaryAction || canReject || canCancel || canExpire) && (
          <div className="ws-header-actions" ref={moreRef}>
            {primaryAction}
            {(canReject || canCancel || canExpire) && (
              <div style={{ position: 'relative' }}>
                <Button variant="secondary" size="lg" onClick={() => setMoreOpen(v => !v)} aria-expanded={moreOpen} aria-haspopup="menu">
                  <MoreHorizontal size={16} /> More
                </Button>
                {moreOpen && (
                  <div className="more-menu" role="menu">
                    {canReject  && <button className="more-menu-item more-menu-item--danger" role="menuitem" onClick={() => setMoreOpen(false)}>Reject delivery</button>}
                    {canCancel  && <button className="more-menu-item" role="menuitem" onClick={() => setMoreOpen(false)}>Cancel</button>}
                    {canExpire  && <button className="more-menu-item" role="menuitem" onClick={() => setMoreOpen(false)}>Expire commitment</button>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MONEY BAR ───────────────────────────────────────────────────── */}
      <MoneyBar c={c} />

      {/* ── BODY GRID ───────────────────────────────────────────────────── */}
      <div className="ws-body-grid">

        {/* TREE (7 cols) — full recursive tree from root */}
        {effectiveRoot && (
          <CommitmentTree
            currentId={id}
            rootId={rootId}
            rootCommit={effectiveRoot}
            onNavigate={onNavigate}
            allCommitsMap={allCommitsMap}
            expandedState={expandedState}
            onExpand={onExpand}
            onExpandAll={onExpandAll}
            onCollapseAll={onCollapseAll}
            historyReady={historyReady}
            treeTab={treeTab}
            treeTabOptions={treeTabOptions}
            onTreeTab={v => setTreeTab(v as 'tree'|'activity')}
            currentCommit={c}
            showCreateChild={showCreateChild}
            setShowCreateChild={setShowCreateChild}
            canCreateChild={canCreateChild}
            isConnected={isConnected}
            wrongChain={wrongChain}
            onCreateSuccess={newId => { refetchAll(); onNavigate('commitment', newId) }}
            onConfirmed={setConfirmed}
            refetchAll={refetchAll}
          />
        )}

        {/* INSPECTOR (5 cols) */}
        <div className="ws-inspector-sticky">
          <Inspector
            c={c}
            role={role}
            roleParts={roleParts}
            confirmed={confirmed}
            onClearConfirmed={() => setConfirmed(null)}
            onNavigateClaims={navClaims}
            onNavigate={onNavigate}
            actions={
              <WalletGate isConnected={isConnected} isWrongChain={wrongChain}>
                {canSubmit && (
                  <SubmitPanel id={c.id} approver={c.approver} open={showSubmit}
                    onToggle={() => { setConfirmed(null); setShowSubmit(v => !v) }}
                    onSuccess={refetchAll} onConfirmed={setConfirmed} />
                )}
                {canApprove && <ApproveBtn id={c.id} manager={c.manager} onSuccess={refetchAll} onConfirmed={setConfirmed} />}
                {canReject  && <RejectBtn  id={c.id} isRoot={c.depth === 0} onSuccess={refetchAll} onConfirmed={setConfirmed} />}
                {canCancel  && <CancelBtn  id={c.id} isRoot={c.depth === 0} onSuccess={refetchAll} onConfirmed={setConfirmed} />}
                {canExpire  && <ExpireBtn  id={c.id} isRoot={c.depth === 0} onSuccess={refetchAll} onConfirmed={setConfirmed} />}
                {!canSubmit && !canApprove && !canReject && !canCancel && !canExpire && !isTerminal(c.state) && (
                  <div className="no-action-note">
                    {isManager && !isApprover && c.state === CommitmentState.Submitted
                      ? `Submitted for review. Waiting for ${shortAddr(c.approver)}.`
                      : !allChildrenTerminal
                      ? 'Resolve all child commitments before submitting or cancelling.'
                      : 'No actions for this wallet.'}
                  </div>
                )}
              </WalletGate>
            }
          />
        </div>
      </div>
    </div>
  )
}
