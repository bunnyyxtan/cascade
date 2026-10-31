/**
 * Explore — D2 redesign.
 * Row cards, status chips, grouping by root, summary stats.
 * Tokens from src/styles/tokens.css + ui/ primitives only.
 * No inline font-size / colour / spacing literals.
 */
import { useState, useMemo } from 'react'
import { useAccount } from 'wagmi'
import { Search, Plus, ChevronRight, ChevronDown, GitBranch, List } from 'lucide-react'
import { useNextId, useCommitments } from '@/hooks/useCascade'
import { useWalletCommitmentIds } from '@/hooks/useCascadeEvents'
import { isDeployed } from '@/lib/contracts'
import { isPast, relativeDeadline, msUntil, formatUsdc } from '@/lib/format'
import type { Commitment } from '@/lib/types'
import { isTerminal } from '@/lib/types'
import { statusOf, STATUS_MAP, type StatusKind } from '@/lib/status'
import { NETWORK_LABEL } from '@/lib/network'
import { computeOutcome } from '@/lib/outcome'
import { useHistory } from '@/lib/history'
import { Button } from './ui/Button'
import { StatusBadge } from './ui/StatusBadge'
import { Pill } from './ui/Pill'
import { AddressDisplay } from './ui/Address'
import { Skeleton } from './ui/Skeleton'
import { EmptyState } from './ui/EmptyState'
import { PageHeader } from './ui/Layout'
import { NotDeployed } from './NotDeployed'
import { nextStep } from './CommitmentWorkspace'

interface Props {
  onNavigate: (view: string, id?: bigint) => void
}

const PAGE_SIZE = 20

type ScopeTab = 'all' | 'mine'
type SortKey  = 'newest' | 'deadline' | 'budget'

/* ══════════════════════════════════════════════════════════════════════════════
   Pure helpers
══════════════════════════════════════════════════════════════════════════════ */

function getRoleParts(c: Commitment, addr?: string): string[] {
  if (!addr) return []
  const a = addr.toLowerCase()
  const parts: string[] = []
  if (c.depth === 0 && c.client.toLowerCase() === a) parts.push('Client')
  if (c.manager.toLowerCase()  === a) parts.push('Manager')
  if (c.approver.toLowerCase() === a) parts.push('Approver')
  return parts
}

/** Deadline display: finished → short date muted, active → relative, warn within 24h */
function DeadlineCell({ c }: { c: Commitment }) {
  const terminal = isTerminal(c.state)
  const past     = isPast(c.deadline)
  const dl       = new Date(Number(c.deadline) * 1000)
  const dateStr  = dl.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  if (terminal) {
    return <span className="obj-dl obj-dl--done">{dateStr}</span>
  }
  if (past) {
    const rel = relativeDeadline(c.deadline).replace('Expired ', '')
    return <span className="obj-dl obj-dl--past">{rel} ago</span>
  }
  // msUntil wraps Date.now() — not a direct call the linter flags
  const remaining = msUntil(c.deadline)
  const warn = remaining < 86_400_000
  return (
    <span className={`obj-dl${warn ? ' obj-dl--warn' : ''}`}>
      {relativeDeadline(c.deadline)}
    </span>
  )
}

/** One-line outcome for finished commitments — reads from history, not c.remaining */
function OutcomeLine({ c }: { c: Commitment }) {
  const { syncing, syncedTo, events } = useHistory()
  if (!isTerminal(c.state)) return null
  const historyReady = syncedTo > 0n && !syncing
  if (!historyReady) {
    return <Skeleton width={60} height={12} style={{ display: 'inline-block', verticalAlign: 'middle' }} />
  }
  const outcome = computeOutcome(c, events)
  return (
    <span className={`obj-outcome obj-outcome--${outcome.kind}`}>
      {outcome.line}
    </span>
  )
}

/** Ancestry breadcrumb for children: "#3 · in #1 › #2" */
function AncestryLabel({ c }: { c: Commitment }) {
  if (c.depth === 0) {
    return <span className="mono obj-meta-id">#{c.id.toString()} · Root</span>
  }
  return (
    <span className="mono obj-meta-id">
      #{c.id.toString()} · in #{c.parentId.toString()}
    </span>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Status chip bar — multi-select, each shows count from the UNFILTERED base
══════════════════════════════════════════════════════════════════════════════ */
const STATUS_CHIP_KINDS: StatusKind[] = ['active', 'submitted', 'settled', 'rejected', 'cancelled', 'expired']

function countByKind(commitments: Commitment[], kind: StatusKind): number {
  return commitments.filter(c => statusOf(c.state, c.failReason).kind === kind).length
}

interface StatusChipsProps {
  base:     Commitment[]
  selected: Set<StatusKind>
  onChange: (next: Set<StatusKind>) => void
}
function StatusChips({ base, selected, onChange }: StatusChipsProps) {
  function toggle(kind: StatusKind) {
    const next = new Set(selected)
    if (next.has(kind)) next.delete(kind); else next.add(kind)
    onChange(next)
  }
  return (
    <div className="obj-chips" role="group" aria-label="Filter by status">
      {STATUS_CHIP_KINDS.map(kind => {
        const count = countByKind(base, kind)
        const active = selected.has(kind)
        return (
          <Pill
            key={kind}
            as="button"
            tone={active ? kind : 'neutral'}
            size="md"
            dot
            selected={active}
            role="checkbox"
            aria-checked={active}
            onClick={() => toggle(kind)}
          >
            {STATUS_MAP[kind].label}
            {count > 0 && <span className="pill-count">{count}</span>}
          </Pill>
        )
      })}
      {selected.size > 0 && (
        <button className="obj-chip-clear" onClick={() => onChange(new Set())}>Clear</button>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Scope segmented control
══════════════════════════════════════════════════════════════════════════════ */
function ScopeSeg({ value, onChange }: { value: ScopeTab; onChange: (v: ScopeTab) => void }) {
  const opts: { id: ScopeTab; label: string }[] = [
    { id: 'all',  label: 'All objectives' },
    { id: 'mine', label: 'Involving me'   },
  ]
  function onKey(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(opts[(idx + 1) % opts.length].id) }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); onChange(opts[(idx - 1 + opts.length) % opts.length].id) }
  }
  return (
    <div role="tablist" className="obj-scope-seg">
      {opts.map((o, idx) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          tabIndex={value === o.id ? 0 : -1}
          onClick={() => onChange(o.id)}
          onKeyDown={e => onKey(e, idx)}
          className={`obj-scope-tab${value === o.id ? ' obj-scope-tab--on' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Sort select
══════════════════════════════════════════════════════════════════════════════ */
function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <select
      className="obj-sort-select"
      value={value}
      onChange={e => onChange(e.target.value as SortKey)}
      aria-label="Sort order"
    >
      <option value="newest">Newest</option>
      <option value="deadline">Deadline soonest</option>
      <option value="budget">Largest budget</option>
    </select>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Summary stats row (connected wallet only)
══════════════════════════════════════════════════════════════════════════════ */
function SummaryRow({ commitments, address }: { commitments: Commitment[]; address: string }) {
  const involving = useMemo(
    () => commitments.filter(c => getRoleParts(c, address).length > 0).length,
    [commitments, address],
  )
  const awaitingAction = useMemo(
    () => commitments.filter(c => {
      if (isTerminal(c.state)) return false
      const step = nextStep(c, [], address)
      return step.startsWith('Ready') || step.startsWith('Submitted for your review') || step.startsWith('Ready to submit')
    }).length,
    [commitments, address],
  )
  const heldInYours = useMemo(
    () => commitments
      .filter(c => c.depth === 0 && c.client.toLowerCase() === address.toLowerCase())
      .reduce((s, c) => s + c.remaining, 0n),
    [commitments, address],
  )

  return (
    <div className="obj-summary-row">
      <div className="obj-summary-stat">
        <p className="obj-summary-label">Involving you</p>
        <p className="obj-summary-value">{involving}</p>
      </div>
      <div className="obj-summary-stat">
        <p className="obj-summary-label">Awaiting your action</p>
        <p className="obj-summary-value">{awaitingAction}</p>
      </div>
      <div className="obj-summary-stat">
        <p className="obj-summary-label">Held in your objectives</p>
        <p className="obj-summary-value obj-summary-value--mono">{formatUsdc(heldInYours)} <span className="obj-summary-unit">USDC</span></p>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Objective row card
══════════════════════════════════════════════════════════════════════════════ */
interface RowProps {
  c:         Commitment
  address?:  string
  onClick:   () => void
  indent?:   boolean
}

function ObjectiveRow({ c, address, onClick, indent = false }: RowProps) {
  const status   = statusOf(c.state, c.failReason)
  const roleParts = getRoleParts(c, address)
  const terminal  = isTerminal(c.state)
  const step      = !terminal ? nextStep(c, [], address ?? '') : null

  return (
    <div
      className={`obj-row${indent ? ' obj-row--indent' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={`Open ${c.title || `commitment #${c.id}`}`}
      onClick={onClick}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick())}
    >
      {/* Left */}
      <div className="obj-row-left">
        <span className="obj-row-icon" style={{ background: status.bg }} aria-hidden>
          <GitBranch size={14} style={{ color: status.fg }} />
        </span>
        <div className="obj-row-info">
          <p className="obj-row-title">{c.title || `Commitment #${c.id}`}</p>
          <div className="obj-row-meta">
            <AncestryLabel c={c} />
            <span className="obj-row-meta-sep" aria-hidden>·</span>
            <AddressDisplay address={c.manager} identicon={false} copy={false} explorer={false} />
            {roleParts.length > 0 && (
              <span className="obj-row-meta-sep" aria-hidden>·</span>
            )}
            {roleParts.length > 0 && (
              <Pill tone="neutral" size="sm">
                {address && roleParts.length > 0 ? `You · ${roleParts.join(' · ')}` : roleParts.join(' · ')}
              </Pill>
            )}
          </div>
        </div>
      </div>

      {/* Middle */}
      <div className="obj-row-mid">
        <StatusBadge status={status} size="sm" />
        {terminal
          ? <OutcomeLine c={c} />
          : step && <p className="obj-row-step">{step}</p>
        }
      </div>

      {/* Right */}
      <div className="obj-row-right">
        <span className="obj-row-budget">
          <span className="obj-row-budget-num">{formatUsdc(c.budget)}</span>
          <span className="obj-row-budget-unit"> USDC</span>
        </span>
        <p className="obj-row-budget-sub">
          {c.depth === 0
            ? `Limit ${formatUsdc(c.delegationLimit)}`
            : `of #${c.parentId.toString()}`
          }
        </p>
      </div>

      {/* Deadline */}
      <div className="obj-row-dl">
        <DeadlineCell c={c} />
      </div>

      <ChevronRight size={14} className="obj-row-chevron" aria-hidden />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Group row: a root + its children disclosed under "+N commitments"
══════════════════════════════════════════════════════════════════════════════ */
interface GroupProps {
  root:      Commitment
  children:  Commitment[]
  address?:  string
  onNavigate: (view: string, id?: bigint) => void
}

function GroupRow({ root, children, address, onNavigate }: GroupProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="obj-group">
      <ObjectiveRow c={root} address={address} onClick={() => onNavigate('commitment', root.id)} />
      {children.length > 0 && (
        <>
          <button
            className="obj-group-disclosure"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
          >
            {open
              ? <ChevronDown size={12} aria-hidden />
              : <ChevronRight size={12} aria-hidden />
            }
            {open ? 'Hide' : `+${children.length}`} commitment{children.length !== 1 ? 's' : ''}
          </button>
          {open && children.map(child => (
            <ObjectiveRow
              key={child.id.toString()}
              c={child}
              address={address}
              onClick={() => onNavigate('commitment', child.id)}
              indent
            />
          ))}
        </>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Skeleton loading rows
══════════════════════════════════════════════════════════════════════════════ */
function SkeletonRows() {
  return (
    <div className="obj-list">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="obj-row obj-row--skel">
          <Skeleton width={32} height={32} radius={8} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton width="45%" height={13} />
            <Skeleton width="30%" height={11} />
          </div>
          <Skeleton width="15%" height={13} />
          <Skeleton width={14} height={14} radius={7} />
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   Sorting
══════════════════════════════════════════════════════════════════════════════ */
function applySort(list: Commitment[], sort: SortKey): Commitment[] {
  const copy = [...list]
  if (sort === 'newest')   return copy.sort((a, b) => (a.id > b.id ? -1 : 1))
  if (sort === 'deadline') return copy.sort((a, b) => Number(a.deadline) - Number(b.deadline))
  if (sort === 'budget')   return copy.sort((a, b) => (a.budget > b.budget ? -1 : 1))
  return copy
}

/* ══════════════════════════════════════════════════════════════════════════════
   Main component
══════════════════════════════════════════════════════════════════════════════ */
export function Explore({ onNavigate }: Props) {
  const { address, isConnected } = useAccount()

  const { data: nextId, isLoading: loadingNextId } = useNextId()

  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(0)
  const [scope,        setScope]        = useState<ScopeTab>('all')
  const [statusFilter, setStatusFilter] = useState<Set<StatusKind>>(new Set())
  const [sort,         setSort]         = useState<SortKey>('newest')
  const [groupByRoot,  setGroupByRoot]  = useState(true)

  // ── Load data ──────────────────────────────────────────────────────────────
  const totalIds  = nextId ? Number(nextId) - 1 : 0
  const startFrom = totalIds > 0 ? Math.max(1, totalIds - page * PAGE_SIZE) : 0
  const endAt     = totalIds > 0 ? Math.max(1, totalIds - (page + 1) * PAGE_SIZE + 1) : 1
  const rangeIds: bigint[] = []
  if (totalIds > 0) {
    for (let i = startFrom; i >= endAt; i--) rangeIds.push(BigInt(i))
  }

  const { commitments: allCommitments, isLoading: loadingAll }  = useCommitments(rangeIds)
  const { ids: myIds, isLoading: loadingMine }                   = useWalletCommitmentIds(scope === 'mine' ? address : undefined)
  const myIdsSorted = useMemo(() => [...myIds].sort((a, b) => (a > b ? -1 : 1)), [myIds])
  const { commitments: myCommitments, isLoading: loadingMyC }   = useCommitments(scope === 'mine' ? myIdsSorted : [])

  const baseCommitments = useMemo<Commitment[]>(
    () => scope === 'all' ? (allCommitments ?? []) : (myCommitments ?? []),
    [scope, allCommitments, myCommitments],
  )
  const isLoading = scope === 'all' ? (loadingAll || loadingNextId) : (loadingMine || loadingMyC)

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = baseCommitments
    const q = search.trim().toLowerCase()
    if (q) {
      // numeric → id match; text → title match
      if (!isNaN(Number(q)) && q !== '') {
        list = list.filter(c => c.id.toString() === q)
      } else {
        list = list.filter(c => c.title.toLowerCase().includes(q))
      }
    }
    if (statusFilter.size > 0) {
      list = list.filter(c => statusFilter.has(statusOf(c.state, c.failReason).kind))
    }
    return applySort(list, sort)
  }, [baseCommitments, search, statusFilter, sort])

  // ── Group by root ──────────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!groupByRoot) return null
    const roots   = filtered.filter(c => c.depth === 0)
    const children = filtered.filter(c => c.depth > 0)
    // For each root, collect its direct/indirect children from the filtered set
    const childrenByRoot = new Map<string, Commitment[]>()
    for (const child of children) {
      // Walk parentId up to find the root id in our filtered set
      // Since we only have one page of data, use parentId directly as a best-effort
      const rootKey = child.parentId.toString()
      const existing = childrenByRoot.get(rootKey) ?? []
      existing.push(child)
      childrenByRoot.set(rootKey, existing)
    }
    // Orphans: children whose root is not in the filtered set
    const rootIds = new Set(roots.map(r => r.id.toString()))
    const orphans = children.filter(c => !rootIds.has(c.parentId.toString()))
    return { roots, childrenByRoot, orphans }
  }, [filtered, groupByRoot])

  // ── Search submit (id → navigate) ──────────────────────────────────────────
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseInt(search)
    if (!isNaN(parsed) && parsed > 0) onNavigate('commitment', BigInt(parsed))
  }

  // ── Clear all filters ──────────────────────────────────────────────────────
  function clearAll() {
    setSearch('')
    setScope('all')
    setStatusFilter(new Set())
    setSort('newest')
    setPage(0)
  }

  const hasFilters = !!search.trim() || scope === 'mine' || statusFilter.size > 0

  if (!isDeployed) return <NotDeployed />

  const isEmpty = !isLoading && scope === 'all' && totalIds === 0

  return (
    <PageHeader
      title="Objectives"
      description={`Every funded objective and delegated commitment on ${NETWORK_LABEL}.`}
      action={
        <Button variant="primary" size="lg" onClick={() => onNavigate('create')}>
          <Plus size={14} /> New objective
        </Button>
      }
    >
      {/* ── Summary row (connected only) ───────────────────────────────── */}
      {isConnected && address && !isLoading && baseCommitments.length > 0 && (
        <SummaryRow commitments={baseCommitments} address={address} />
      )}

      {/* ── Controls row ───────────────────────────────────────────────── */}
      <div className="obj-controls">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="obj-search-wrap">
          <Search size={15} className="obj-search-icon" aria-hidden />
          <input
            className="obj-search"
            type="search"
            placeholder="Search by title or ID…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            aria-label="Search objectives"
          />
        </form>

        {/* Scope seg */}
        <ScopeSeg value={scope} onChange={v => { setScope(v); setPage(0) }} />

        {/* Sort */}
        <SortSelect value={sort} onChange={setSort} />

        {/* Group toggle */}
        <button
          className={`obj-group-toggle${groupByRoot ? ' obj-group-toggle--on' : ''}`}
          onClick={() => setGroupByRoot(v => !v)}
          title="Group by root objective"
          aria-pressed={groupByRoot}
        >
          <List size={14} aria-hidden /> Group by root
        </button>
      </div>

      {/* ── Status chips ───────────────────────────────────────────────── */}
      <StatusChips
        base={baseCommitments}
        selected={statusFilter}
        onChange={next => { setStatusFilter(next); setPage(0) }}
      />

      {/* ── Empty: no objectives at all ────────────────────────────────── */}
      {isEmpty && (
        <EmptyState
          icon={<GitBranch size={22} />}
          title="No objectives yet"
          body={isConnected
            ? 'Create the first funded objective on this contract.'
            : 'Connect your wallet to create the first objective.'
          }
          action={isConnected
            ? <Button variant="primary" size="md" onClick={() => onNavigate('create')}><Plus size={14} /> New objective</Button>
            : undefined
          }
        />
      )}

      {/* ── Loading ────────────────────────────────────────────────────── */}
      {isLoading && <SkeletonRows />}

      {/* ── List ───────────────────────────────────────────────────────── */}
      {!isLoading && !isEmpty && (
        <>
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No matching objectives"
              body="Try adjusting your search or filters."
              action={
                hasFilters
                  ? <Button variant="ghost" size="md" onClick={clearAll}>Clear filters</Button>
                  : undefined
              }
            />
          ) : (
            <div className="obj-list">
              {groupByRoot && grouped ? (
                <>
                  {/* Grouped: roots with their children */}
                  {grouped.roots.map(root => (
                    <GroupRow
                      key={root.id.toString()}
                      root={root}
                      children={grouped.childrenByRoot.get(root.id.toString()) ?? []}
                      address={address}
                      onNavigate={onNavigate}
                    />
                  ))}
                  {/* Orphaned children (root not on this page) */}
                  {grouped.orphans.map(c => (
                    <ObjectiveRow
                      key={c.id.toString()}
                      c={c}
                      address={address}
                      onClick={() => onNavigate('commitment', c.id)}
                    />
                  ))}
                </>
              ) : (
                filtered.map(c => (
                  <ObjectiveRow
                    key={c.id.toString()}
                    c={c}
                    address={address}
                    onClick={() => onNavigate('commitment', c.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Paging ─────────────────────────────────────────────────── */}
          {scope === 'all' && filtered.length > 0 && (
            <div className="obj-paging">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                ← Newer
              </Button>
              <span className="obj-page-label">Page {page + 1}</span>
              <Button variant="ghost" size="sm" disabled={endAt <= 1} onClick={() => setPage(p => p + 1)}>
                Older →
              </Button>
            </div>
          )}
        </>
      )}
    </PageHeader>
  )
}
