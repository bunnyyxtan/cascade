/**
 * Activity feed — global (no commitmentId) or per-commitment.
 * D4 redesign: category chips, "Involving me" filter, day-grouped rows,
 * 36px icon tiles, sentence descriptions, signed amounts, local time,
 * block number in tooltip. Pagination: 25/page "Load older".
 *
 * Data layer (useCascadeActivity, history store) is unchanged.
 */
import { useState, useMemo } from 'react'
import { useAccount }        from 'wagmi'
import {
  RefreshCw, ExternalLink, GitBranch, Check,
  Clock, Send, Plus, ArrowDownLeft,
} from 'lucide-react'
import { useCascadeActivity }       from '@/hooks/useCascadeEvents'
import type { ActivityEvent }       from '@/hooks/useCascadeEvents'
import { useBlockTimestamps }       from '@/lib/blockTimestamps'
import { formatUsdc, shortAddr }    from '@/lib/format'
import { txUrl, addrUrl }           from '@/lib/contracts'
import { NETWORK_LABEL }            from '@/lib/network'
import { PageHeader }               from './ui/Layout'
import { EmptyState }               from './ui/EmptyState'
import { ReadError }                from './ui/ReadError'
import { Skeleton }                 from './ui/Skeleton'
import { Button }                   from './ui/Button'
import { Tooltip }                  from './ui/Tooltip'

const PAGE_SIZE = 25

/* ── Category definitions ──────────────────────────────────────────────────── */

type Category = 'funding' | 'delegation' | 'work' | 'settlement' | 'recovery'

interface CategoryDef {
  id:     Category
  label:  string
  events: string[]
  Icon:   React.ElementType
  color:  string
  bg:     string
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'funding', label: 'Funding',
    events: ['RootCreated'],
    Icon: Plus, color: 'var(--ok)', bg: 'var(--lime-soft)',
  },
  {
    id: 'delegation', label: 'Delegation',
    events: ['ChildCreated'],
    Icon: GitBranch, color: '#4A6131', bg: '#EAF2D8',
  },
  {
    id: 'work', label: 'Work',
    events: ['DeliverySubmitted'],
    Icon: Send, color: 'var(--warn)', bg: '#FDF3DF',
  },
  {
    id: 'settlement', label: 'Settlement',
    events: ['CommitmentApproved', 'Claimed'],
    Icon: Check, color: 'var(--ok)', bg: 'var(--lime-soft)',
  },
  {
    id: 'recovery', label: 'Recovery',
    events: ['FundsReturned', 'CommitmentRejected', 'CommitmentCancelled', 'CommitmentExpired'],
    Icon: ArrowDownLeft, color: 'var(--bad)', bg: '#FBEAEA',
  },
]

function categoryFor(eventName: string): CategoryDef {
  return CATEGORIES.find(c => c.events.includes(eventName))
    ?? { id: 'funding', label: eventName, events: [eventName], Icon: Clock, color: 'var(--muted)', bg: 'var(--tint)' }
}

/* ── "Involving me" filter ─────────────────────────────────────────────────── */

function involvesAddress(ev: ActivityEvent, addr: string): boolean {
  const lc = addr.toLowerCase()
  const a  = ev.args
  function s(k: string): string {
    const v = a[k]; return (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') ? String(v).toLowerCase() : ''
  }
  return (
    s('client')   === lc || s('manager')  === lc ||
    s('approver') === lc || s('account')  === lc
  )
}

/* ── Row sentence + amount ─────────────────────────────────────────────────── */

function bn(v: unknown): bigint {
  const s = (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') ? String(v) : '0'
  try { return BigInt(s) } catch { return 0n }
}
function str(v: unknown): string {
  return (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') ? String(v) : ''
}

interface RowContent {
  sentence: React.ReactNode
  actor:    string | undefined
  amount:   bigint | null
  amountSign: '+' | '↩' | 'escrowed' | null
}

function rowContent(ev: ActivityEvent, onNavigate?: (view: string, id?: bigint) => void): RowContent {
  const a = ev.args
  const link = (id: bigint) => (
    <button
      className="act-id-link"
      onClick={() => onNavigate?.('commitment', id)}
      aria-label={`Go to objective #${id}`}
    >
      #{id.toString()}
    </button>
  )

  switch (ev.eventName) {
    case 'RootCreated': {
      const id = bn(a.id); const title = str(a.title); const client = str(a.client)
      return {
        sentence: <><strong>{link(id)}</strong> funded{title ? ` — ${title}` : ''}</>,
        actor: client || undefined, amount: bn(a.budget), amountSign: 'escrowed',
      }
    }
    case 'ChildCreated': {
      const id = bn(a.id); const parentId = bn(a.parentId); const manager = str(a.manager)
      return {
        sentence: <><strong>{link(id)}</strong> delegated under {link(parentId)}</>,
        actor: manager || undefined, amount: bn(a.budget), amountSign: 'escrowed',
      }
    }
    case 'DeliverySubmitted': {
      const id = bn(a.id); const manager = str(a.manager)
      return {
        sentence: <><strong>{link(id)}</strong> delivery submitted</>,
        actor: manager || undefined, amount: null, amountSign: null,
      }
    }
    case 'CommitmentApproved': {
      const id = bn(a.id); const released = bn(a.released); const to = str(a.manager)
      return {
        sentence: <><strong>{link(id)}</strong> approved — released to {
          to ? <span className="mono">{shortAddr(to)}</span> : 'manager'
        }</>,
        actor: str(a.approver) || undefined, amount: released, amountSign: '+',
      }
    }
    case 'CommitmentRejected': {
      const id = bn(a.id)
      return {
        sentence: <><strong>{link(id)}</strong> rejected</>,
        actor: str(a.approver) || undefined, amount: null, amountSign: null,
      }
    }
    case 'CommitmentCancelled': {
      const id = bn(a.id)
      return {
        sentence: <><strong>{link(id)}</strong> cancelled</>,
        actor: str(a.manager) || undefined, amount: null, amountSign: null,
      }
    }
    case 'CommitmentExpired': {
      const id = bn(a.id)
      return {
        sentence: <><strong>{link(id)}</strong> expired</>,
        actor: undefined, amount: null, amountSign: null,
      }
    }
    case 'FundsReturned': {
      const childId = bn(a.childId); const parentId = bn(a.parentId); const amount = bn(a.amount)
      return {
        sentence: <><strong>{link(childId)}</strong> funds returned to {link(parentId)}</>,
        actor: undefined, amount, amountSign: '↩',
      }
    }
    case 'Claimed': {
      const amount = bn(a.amount); const account = str(a.account)
      return {
        sentence: <>Withdrawal by <span className="mono">{shortAddr(account)}</span></>,
        actor: account || undefined, amount, amountSign: '+',
      }
    }
    default:
      return { sentence: ev.eventName, actor: undefined, amount: null, amountSign: null }
  }
}

/* ── Time utilities ────────────────────────────────────────────────────────── */

function dayKey(ts: number): string {
  // Returns YYYY-MM-DD in local time
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(key: string): string {
  const todayKey    = dayKey(Math.floor(Date.now() / 1000))
  const yesterdayTs = Math.floor(Date.now() / 1000) - 86400
  const yesterKey   = dayKey(yesterdayTs)
  if (key === todayKey)     return 'Today'
  if (key === yesterKey)    return 'Yesterday'
  const d = new Date(`${key}T12:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function localTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/* ── Amount display ────────────────────────────────────────────────────────── */

function AmountCell({ amount, sign }: { amount: bigint; sign: '+' | '↩' | 'escrowed' }) {
  const fmt = formatUsdc(amount)
  if (sign === '+')       return <span className="act-amount act-amount--plus">+{fmt}</span>
  if (sign === '↩')       return <span className="act-amount act-amount--return">↩ {fmt}</span>
  return <span className="act-amount act-amount--escrow">{fmt} escrowed</span>
}

/* ── Single event row ──────────────────────────────────────────────────────── */

function EventRow({
  ev, tsMap, onNavigate,
}: {
  ev: ActivityEvent
  tsMap: Map<bigint, number>
  onNavigate?: (view: string, id?: bigint) => void
}) {
  const cat  = categoryFor(ev.eventName)
  const ts   = tsMap.get(ev.blockNumber)
  const { sentence, actor, amount, amountSign } = rowContent(ev, onNavigate)

  return (
    <div className="act-row" role="listitem">
      {/* Icon tile */}
      <div className="act-icon" style={{ background: cat.bg }}>
        <cat.Icon size={16} style={{ color: cat.color }} strokeWidth={2} />
      </div>

      {/* Middle */}
      <div className="act-middle">
        <p className="act-sentence">{sentence}</p>
        <p className="act-meta">
          {actor && (
            <a
              href={addrUrl(actor)}
              target="_blank"
              rel="noreferrer"
              className="mono act-actor"
              aria-label={`Actor: ${actor}`}
            >
              {shortAddr(actor)}
            </a>
          )}
          {actor && <span className="act-sep">·</span>}
          {ts ? (
            <Tooltip
              trigger={<span className="act-time">{localTime(ts)}</span>}
              content={`Block ${ev.blockNumber.toString()}`}
              label={`Block ${ev.blockNumber.toString()}`}
            />
          ) : (
            <Tooltip
              trigger={<Skeleton width={36} height={12} />}
              content={`Block ${ev.blockNumber.toString()}`}
              label={`Block ${ev.blockNumber.toString()}`}
            />
          )}
          {ev.transactionHash && (
            <>
              <span className="act-sep">·</span>
              <a
                href={txUrl(ev.transactionHash)}
                target="_blank"
                rel="noreferrer"
                className="act-tx-link"
              >
                View tx <ExternalLink size={10} strokeWidth={2} />
              </a>
            </>
          )}
        </p>
      </div>

      {/* Right: amount */}
      {amount !== null && amountSign !== null && (
        <div className="act-right">
          <AmountCell amount={amount} sign={amountSign} />
        </div>
      )}
    </div>
  )
}

/* ── Day header ────────────────────────────────────────────────────────────── */

function DayHeader({ label, embedded }: { label: string; embedded?: boolean }) {
  return (
    <div className={`act-day-header${embedded ? ' act-day-header--embedded' : ''}`} role="rowheader">
      {label}
    </div>
  )
}

/* ── Category chip ─────────────────────────────────────────────────────────── */

function CategoryChip({
  cat, selected, count, onToggle,
}: {
  cat: CategoryDef
  selected: boolean
  count: number
  onToggle: () => void
}) {
  return (
    <button
      className={`act-chip${selected ? ' act-chip--on' : ''}`}
      onClick={onToggle}
      aria-pressed={selected}
      style={selected ? { '--chip-color': cat.color, '--chip-bg': cat.bg } as React.CSSProperties : undefined}
    >
      <cat.Icon size={13} strokeWidth={2} />
      {cat.label}
      <span className="act-chip-count">{count}</span>
    </button>
  )
}

/* ── Main component ────────────────────────────────────────────────────────── */

interface Props {
  commitmentId?: bigint
  onNavigate?:   (view: string, id?: bigint) => void
  embedded?:     boolean
}

export function Activity({ commitmentId, onNavigate, embedded }: Props) {
  const { address } = useAccount()
  const { events, isLoading, syncing, progress, error, refetch } = useCascadeActivity(commitmentId)
  const [page, setPage] = useState(0)
  const [selectedCats, setSelectedCats] = useState<Set<Category>>(new Set())
  const [involvingMe,  setInvolvingMe]  = useState(false)

  // Collect all unique block numbers so we can request timestamps
  const blockNumbers = useMemo(() => [...new Set(events.map(e => e.blockNumber))], [events])
  const tsMap = useBlockTimestamps(blockNumbers)

  // Filter
  const filtered = useMemo(() => {
    let result = events
    if (selectedCats.size > 0) {
      result = result.filter(ev => {
        const cat = categoryFor(ev.eventName)
        return selectedCats.has(cat.id)
      })
    }
    if (involvingMe && address) {
      result = result.filter(ev => involvesAddress(ev, address))
    }
    return result
  }, [events, selectedCats, involvingMe, address])

  // Count per category (from unfiltered base)
  const catCounts = useMemo(() => {
    const counts = new Map<Category, number>()
    for (const ev of events) {
      const cat = categoryFor(ev.eventName)
      counts.set(cat.id, (counts.get(cat.id) ?? 0) + 1)
    }
    return counts
  }, [events])

  // Reset page on filter change
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages - 1)
  const pageEvents = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  // Group by day
  const grouped = useMemo(() => {
    const groups: Array<{ key: string; label: string; events: ActivityEvent[] }> = []
    let current: { key: string; label: string; events: ActivityEvent[] } | null = null

    for (const ev of pageEvents) {
      const ts  = tsMap.get(ev.blockNumber)
      const key = ts ? dayKey(ts) : `block-${ev.blockNumber}`
      if (!current || current.key !== key) {
        current = { key, label: ts ? dayLabel(key) : `Block ${ev.blockNumber}`, events: [] }
        groups.push(current)
      }
      current.events.push(ev)
    }
    return groups
  }, [pageEvents, tsMap])

  function toggleCat(id: Category) {
    setSelectedCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setPage(0)
  }

  const errorMsg = error ? (error as { message?: string }).message ?? String(error) : undefined

  const isGlobalFeed = commitmentId === undefined

  const feed = (
    <div className="act-card">
      {/* Controls */}
      {isGlobalFeed && (
        <div className="act-controls">
          {/* Category chips */}
          <div className="act-chips" role="group" aria-label="Filter by category">
            {CATEGORIES.map(cat => (
              <CategoryChip
                key={cat.id}
                cat={cat}
                selected={selectedCats.has(cat.id)}
                count={catCounts.get(cat.id) ?? 0}
                onToggle={() => toggleCat(cat.id)}
              />
            ))}
            {address && (
              <button
                className={`act-chip act-chip--me${involvingMe ? ' act-chip--on' : ''}`}
                onClick={() => { setInvolvingMe(v => !v); setPage(0) }}
                aria-pressed={involvingMe}
              >
                Involving me
              </button>
            )}
          </div>

          {/* Refresh + clear */}
          <div className="act-controls-right">
            {(selectedCats.size > 0 || involvingMe) && (
              <button
                className="act-clear-btn"
                onClick={() => { setSelectedCats(new Set()); setInvolvingMe(false); setPage(0) }}
              >
                Clear filters
              </button>
            )}
            <button
              className="act-refresh-btn"
              onClick={() => void refetch()}
              title="Refresh activity"
              aria-label="Refresh activity"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Sync progress */}
      {syncing && events.length > 0 && (
        <div className="act-sync-bar">
          <span className="act-sync-label">
            Syncing from {NETWORK_LABEL} · {Math.round(progress * 100)}%
          </span>
          <div className="act-sync-track">
            <div className="act-sync-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="act-body" role="list">
        {/* Loading skeletons */}
        {isLoading && (
          <>
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="act-row act-row--skeleton" role="listitem">
                <Skeleton width={36} height={36} style={{ borderRadius: 10, flexShrink: 0 }} />
                <div className="act-middle">
                  <Skeleton width={`${[68, 52, 75, 58][i]}%`} height={14} style={{ marginBottom: 5 }} />
                  <Skeleton width="30%" height={11} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="act-state-pad">
            <ReadError message={errorMsg} onRetry={() => void refetch()} />
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && events.length === 0 && (
          <div className="act-state-pad">
            <EmptyState
              icon={<Clock size={28} strokeWidth={1.5} />}
              title="No activity yet"
              body="Onchain transitions will appear here once the contract is used."
            />
          </div>
        )}

        {/* No results after filtering */}
        {!isLoading && !error && events.length > 0 && filtered.length === 0 && (
          <div className="act-state-pad">
            <EmptyState
              icon={<RefreshCw size={28} strokeWidth={1.5} />}
              title="No matching events"
              body="Try clearing the category filter or the 'Involving me' toggle."
              action={
                <Button variant="secondary" size="sm"
                  onClick={() => { setSelectedCats(new Set()); setInvolvingMe(false) }}>
                  Clear filters
                </Button>
              }
            />
          </div>
        )}

        {/* Grouped event rows */}
        {!isLoading && !error && filtered.length > 0 && (
          <>
            {grouped.map(group => (
              <div key={group.key} className="act-group">
                <DayHeader label={group.label} embedded={embedded} />
                {group.events.map((ev, i) => (
                  <EventRow
                    key={`${ev.transactionHash ?? 'null'}-${ev.logIndex}-${i}`}
                    ev={ev}
                    tsMap={tsMap}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="act-pagination">
          <button
            className="act-pag-btn"
            disabled={safePage === 0}
            onClick={() => setPage(p => Math.max(0, p - 1))}
          >
            Newer
          </button>
          <span className="act-pag-counter mono">
            {safePage + 1} / {totalPages}
          </span>
          <button
            className="act-pag-btn"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          >
            Load older
          </button>
        </div>
      )}
    </div>
  )

  if (!isGlobalFeed) return feed

  return (
    <>
      <PageHeader
        kicker="AUDITABLE ACTIVITY"
        title="Activity"
        description={`Every onchain transition of Cascade on ${NETWORK_LABEL}, newest first.`}
      />
      {feed}
    </>
  )
}
