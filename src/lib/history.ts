/**
 * Cascade event history store — module singleton, useSyncExternalStore.
 *
 * - Fetches all events from VITE_CASCADE_DEPLOY_BLOCK (or head-10000)
 *   in ascending 9,000-block chunks, ≤4 in flight at a time.
 * - Caches to localStorage as { lastBlock, events } (bigints as decimal strings).
 * - On mount: loads cache immediately, then fetches from lastBlock+1 to head.
 * - Polls head every 15s while tab is visible.
 * - Exposes eventsFor(id), claimsFor(address), and progress (0–1).
 * - On chunk error: retries twice (200ms, 800ms backoff), then surfaces error.
 */

import { createPublicClient, http, parseEventLogs } from 'viem'
import { useSyncExternalStore, useEffect } from 'react'
import { cascadeAbi } from './cascadeAbi'
import { CASCADE_ADDRESS } from './contracts'
import { CHAIN, CHAIN_ID as NET_CHAIN_ID, RPC_URL } from './network'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HistoryEvent {
  eventName: string
  args: Record<string, unknown>
  blockNumber: bigint
  transactionHash: `0x${string}` | null
  logIndex: number
}

export interface HistoryState {
  events: HistoryEvent[]
  syncing: boolean
  progress: number       // 0–1
  syncedTo: bigint       // last block successfully synced
  error: string | null
}

// ── RPC client ────────────────────────────────────────────────────────────────

function getClient() {
  return createPublicClient({ chain: CHAIN, transport: http(RPC_URL) })
}

// ── Type-safe string coercion for decoded event args ─────────────────────────
type Primitive = string | number | bigint | boolean | null | undefined
function toStr(v: Primitive): string { return v == null ? '' : String(v) }

// ── localStorage cache ────────────────────────────────────────────────────────

const CACHE_KEY = `cascade:history:${NET_CHAIN_ID}:${CASCADE_ADDRESS?.toLowerCase() ?? 'none'}`
const CHUNK_SIZE = 9_000n
const MAX_INFLIGHT = 4
const POLL_INTERVAL = 15_000

type CacheEntry = {
  lastBlock: string
  events: Array<{
    eventName: string
    args: Record<string, string | number | boolean | null>
    blockNumber: string
    transactionHash: string | null
    logIndex: number
  }>
}

function saveCache(lastBlock: bigint, events: HistoryEvent[]) {
  try {
    const entry: CacheEntry = {
      lastBlock: lastBlock.toString(),
      events: events.map(e => ({
        eventName: e.eventName,
        args: Object.fromEntries(
          Object.entries(e.args).map(([k, v]) => [
            k,
            typeof v === 'bigint' ? v.toString()
            : typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null ? v
            : null,
          ]),
        ),
        blockNumber: e.blockNumber.toString(),
        transactionHash: e.transactionHash,
        logIndex: e.logIndex,
      })),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch { /* quota exceeded — ignore */ }
}

function loadCache(): { lastBlock: bigint; events: HistoryEvent[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    const events: HistoryEvent[] = entry.events.map(e => ({
      eventName: e.eventName,
      args: e.args,
      blockNumber: BigInt(e.blockNumber),
      transactionHash: e.transactionHash as `0x${string}` | null,
      logIndex: e.logIndex,
    }))
    return { lastBlock: BigInt(entry.lastBlock), events }
  } catch { return null }
}

// ── Fetch a single chunk with retry ──────────────────────────────────────────

async function fetchChunk(from: bigint, to: bigint): Promise<HistoryEvent[]> {
  const client = getClient()
  const addr = CASCADE_ADDRESS as `0x${string}`

  async function attempt(): Promise<HistoryEvent[]> {
    const raw = await client.getLogs({ address: addr, fromBlock: from, toBlock: to })
    const decoded = parseEventLogs({ abi: cascadeAbi, logs: raw })
    return decoded.map(log => ({
      eventName: log.eventName,
      args: (log.args as Record<string, unknown>) ?? {},
      blockNumber: log.blockNumber ?? 0n,
      transactionHash: log.transactionHash ?? null,
      logIndex: log.logIndex ?? 0,
    }))
  }

  for (let attempt_ = 0; attempt_ < 3; attempt_++) {
    try {
      return await attempt()
    } catch (e) {
      if (attempt_ < 2) {
        await new Promise(r => setTimeout(r, attempt_ === 0 ? 200 : 800))
      } else {
        throw e
      }
    }
  }
  throw new Error('unreachable')
}

// ── Store internals ───────────────────────────────────────────────────────────

const cached = loadCache()

let _state: HistoryState = {
  events: cached?.events ?? [],
  syncing: false,
  progress: 0,
  syncedTo: cached?.lastBlock ?? 0n,
  error: null,
}

const listeners = new Set<() => void>()
let _refetchCallbacks: Array<() => void> = []
let _pollTimer: ReturnType<typeof setTimeout> | null = null
let _syncing = false

function notify() {
  listeners.forEach(l => l())
}

function setState(patch: Partial<HistoryState>) {
  _state = { ..._state, ...patch }
  notify()
}

// ── Core sync ─────────────────────────────────────────────────────────────────

async function syncFrom(fromBlock: bigint, head: bigint): Promise<void> {
  if (fromBlock > head) {
    setState({ syncing: false, progress: 1 })
    return
  }

  // Build all chunk ranges
  const ranges: Array<{ from: bigint; to: bigint }> = []
  for (let start = fromBlock; start <= head; start += CHUNK_SIZE) {
    ranges.push({ from: start, to: start + CHUNK_SIZE - 1n < head ? start + CHUNK_SIZE - 1n : head })
  }

  const total = ranges.length
  let done = 0
  const newEvents: HistoryEvent[] = []

  // Process in batches of MAX_INFLIGHT; checkpoint after every batch
  for (let i = 0; i < ranges.length; i += MAX_INFLIGHT) {
    const batch = ranges.slice(i, i + MAX_INFLIGHT)
    const results = await Promise.all(batch.map(r => fetchChunk(r.from, r.to)))
    for (const chunk of results) newEvents.push(...chunk)
    done += batch.length

    // Checkpoint: merge + save after each batch so a later failure
    // resumes from the last saved syncedTo rather than deploy block
    const checkpointBlock = ranges[i + batch.length - 1].to
    const mergedSoFar = [..._state.events, ...newEvents]
    const seenSoFar = new Set<string>()
    const dedupedSoFar = mergedSoFar.filter(e => {
      const key = `${e.transactionHash ?? 'null'}-${e.logIndex}`
      if (seenSoFar.has(key)) return false
      seenSoFar.add(key)
      return true
    })
    dedupedSoFar.sort((a, b) => Number(b.blockNumber - a.blockNumber) || b.logIndex - a.logIndex)
    saveCache(checkpointBlock, dedupedSoFar)
    setState({ events: dedupedSoFar, progress: done / total, syncing: true, syncedTo: checkpointBlock })
  }

  // Final state after all batches
  setState({ syncing: false, progress: 1, error: null })
}

export async function syncHistory(force = false): Promise<void> {
  if (!CASCADE_ADDRESS) return
  if (_syncing && !force) return
  _syncing = true

  try {
    const client = getClient()
    const head = await client.getBlockNumber()

    const deployBlock = import.meta.env.VITE_CASCADE_DEPLOY_BLOCK
      ? BigInt(import.meta.env.VITE_CASCADE_DEPLOY_BLOCK as string)
      : head > 10_000n ? head - 10_000n : 0n

    const fromBlock = _state.syncedTo > 0n ? _state.syncedTo + 1n : deployBlock

    if (fromBlock > head) {
      // Already up to date
      setState({ syncing: false, progress: 1 })
      return
    }

    setState({ syncing: true, error: null })
    await syncFrom(fromBlock, head)
  } catch (e) {
    setState({ syncing: false, error: e instanceof Error ? e.message : String(e) })
  } finally {
    _syncing = false
    schedulePoll()
  }
}

function schedulePoll() {
  if (_pollTimer) clearTimeout(_pollTimer)
  _pollTimer = setTimeout(() => {
    if (document.visibilityState !== 'hidden') void syncHistory()
  }, POLL_INTERVAL)
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getSnapshot(): HistoryState {
  return _state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function registerRefetch(cb: () => void) {
  _refetchCallbacks.push(cb)
  return () => { _refetchCallbacks = _refetchCallbacks.filter(x => x !== cb) }
}

/** Called by useCascadeWrite hooks after a confirmed write to re-sync. */
export function triggerRefetch() {
  void syncHistory(true)
}

function argBigInt(a: Record<string, unknown>, key: string): bigint {
  try { return BigInt(toStr((a[key] as Primitive) ?? 0)) } catch { return 0n }
}
function argStr(a: Record<string, unknown>, key: string): string {
  return toStr(a[key] as Primitive)
}

/** Select events relevant to a commitment id (by id, parentId, or childId). */
export function eventsFor(id: bigint): HistoryEvent[] {
  return _state.events.filter(ev => {
    const a = ev.args
    switch (ev.eventName) {
      case 'RootCreated':
      case 'DeliverySubmitted':
      case 'CommitmentApproved':
      case 'CommitmentRejected':
      case 'CommitmentCancelled':
      case 'CommitmentExpired':
        return argBigInt(a, 'id') === id
      case 'ChildCreated':
        return argBigInt(a, 'id') === id || argBigInt(a, 'parentId') === id
      case 'FundsReturned':
        return argBigInt(a, 'parentId') === id || argBigInt(a, 'childId') === id
      default:
        return false
    }
  })
}

/** Select Claimed events for a wallet address. */
export function claimsFor(address: string): HistoryEvent[] {
  const addrLc = address.toLowerCase()
  return _state.events.filter(e =>
    e.eventName === 'Claimed' &&
    argStr(e.args, 'account').toLowerCase() === addrLc,
  )
}

// ── React hooks ───────────────────────────────────────────────────────────────

export function useHistory() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  // Boot sync on first mount; also set up visibility listener
  useEffect(() => {
    void syncHistory()

    function onVisible() {
      if (document.visibilityState !== 'hidden') void syncHistory()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return {
    ...state,
    retry: () => syncHistory(true),
  }
}
