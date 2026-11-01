/**
 * Cascade event history store — module singleton, useSyncExternalStore.
 *
 * - Fetches all events from VITE_CASCADE_DEPLOY_BLOCK (or head-10000)
 *   in ascending 1,000-block chunks (Arc public RPC safe batch size).
 * - Sequential processing: one chunk at a time, with 150ms inter-chunk
 *   pacing to avoid overwhelming the shared public endpoint.
 * - Exponential backoff with jitter on errors; detects 429 / rate-limit
 *   responses and respects Retry-After when present.
 * - Caches to localStorage as { lastBlock, events } (bigints as decimal strings).
 * - On mount: loads cache immediately, then fetches from lastBlock+1 to head.
 * - Polls head every 30s while tab is visible (reduced from 15s).
 * - Exposes eventsFor(id), claimsFor(address), and progress (0–1).
 * - Guards against overlapping sync runs (_syncing flag).
 */

import { parseEventLogs } from 'viem'
import { useSyncExternalStore, useEffect } from 'react'
import { cascadeAbi } from './cascadeAbi'
import { CASCADE_ADDRESS } from './contracts'
import { CHAIN_ID as NET_CHAIN_ID, NETWORK_LABEL, getPublicClient } from './network'

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

// ── RPC client — delegates to the shared singleton in network.ts ─────────────
// All standalone reads use getPublicClient() so transport selection
// (Vercel proxy / Studio proxy / public RPC) is determined in one place.
const getClient = getPublicClient

// ── Type-safe string coercion for decoded event args ─────────────────────────
type Primitive = string | number | bigint | boolean | null | undefined
function toStr(v: Primitive): string { return v == null ? '' : String(v) }

// ── localStorage cache ────────────────────────────────────────────────────────

const CACHE_KEY = `cascade:history:${NET_CHAIN_ID}:${CASCADE_ADDRESS?.toLowerCase() ?? 'none'}`

/**
 * Arc docs recommend 1,000-block batches for eth_getLogs.
 * Arc runs sub-second blocks — 1,000 blocks ≈ a few minutes of chain time.
 * 9,000-block chunks were causing rate-limit errors on the public endpoint.
 */
const CHUNK_SIZE = 1_000n

/**
 * Sequential processing: one chunk at a time.
 * Concurrent requests to the public Arc RPC endpoint cause rate-limit errors.
 */
const MAX_INFLIGHT = 1

/** Checkpoint every N sequential chunks so a failure resumes nearby. */
const CHECKPOINT_EVERY = 10

/** Milliseconds to wait between consecutive chunk requests (pacing). */
const INTER_CHUNK_DELAY = 150

/** Polling interval in ms — reduced from 15s to 30s to lower background load. */
const POLL_INTERVAL = 30_000

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

// ── Rate-limit detection ──────────────────────────────────────────────────────

/**
 * Returns the Retry-After delay in ms if the error looks like a 429 / rate-limit.
 * Checks HTTP status codes embedded in viem error messages and error bodies.
 */
function rateLimitDelay(err: unknown): number | null {
  if (!(err instanceof Error)) return null
  const msg = err.message.toLowerCase()
  // Direct 429 or rate-limit keywords
  if (!msg.includes('429') && !msg.includes('rate') && !msg.includes('limit') && !msg.includes('too many')) return null
  // Try to extract Retry-After from the message (some RPCs embed it)
  const retryAfterMatch = /retry.?after[:\s]+(\d+)/i.exec(err.message)
  if (retryAfterMatch) return parseInt(retryAfterMatch[1], 10) * 1000
  return 5_000 // default 5s back-off on rate-limit
}

/** Clamp a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Exponential back-off with jitter: baseMs * 2^attempt + random(0, jitterMs). */
function backoffMs(attempt: number, baseMs = 1_000, maxMs = 30_000, jitterMs = 500): number {
  const exp = clamp(baseMs * Math.pow(2, attempt), baseMs, maxMs)
  return exp + Math.random() * jitterMs
}

// ── Fetch a single chunk with retry + rate-limit awareness ───────────────────

async function fetchChunk(from: bigint, to: bigint): Promise<HistoryEvent[]> {
  const client = getClient()
  const addr = CASCADE_ADDRESS as `0x${string}`

  const MAX_ATTEMPTS = 4

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await client.getLogs({ address: addr, fromBlock: from, toBlock: to })
      const decoded = parseEventLogs({ abi: cascadeAbi, logs: raw })
      return decoded.map(log => ({
        eventName: log.eventName,
        args: (log.args as Record<string, unknown>) ?? {},
        blockNumber: log.blockNumber ?? 0n,
        transactionHash: log.transactionHash ?? null,
        logIndex: log.logIndex ?? 0,
      }))
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS - 1) throw e

      // Check for rate-limit first — use its suggested delay if available
      const rlDelay = rateLimitDelay(e)
      if (rlDelay !== null) {
        await new Promise(r => setTimeout(r, rlDelay))
      } else {
        // Exponential back-off for other transient errors
        await new Promise(r => setTimeout(r, backoffMs(attempt)))
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
let _syncing     = false
let _pendingForce = false   // set when a forced sync arrives during an active sync

function notify() {
  listeners.forEach(l => l())
}

function setState(patch: Partial<HistoryState>) {
  _state = { ..._state, ...patch }
  notify()
}

// ── Dedup helper ──────────────────────────────────────────────────────────────

function dedup(events: HistoryEvent[]): HistoryEvent[] {
  const seen = new Set<string>()
  return events.filter(e => {
    const key = `${e.transactionHash ?? 'null'}-${e.logIndex}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ── Core sync — sequential with pacing ───────────────────────────────────────

async function syncFrom(fromBlock: bigint, head: bigint): Promise<void> {
  if (fromBlock > head) {
    setState({ syncing: false, progress: 1 })
    return
  }

  // Build all chunk ranges
  const ranges: Array<{ from: bigint; to: bigint }> = []
  for (let start = fromBlock; start <= head; start += CHUNK_SIZE) {
    const end = start + CHUNK_SIZE - 1n < head ? start + CHUNK_SIZE - 1n : head
    ranges.push({ from: start, to: end })
  }

  const total = ranges.length
  let done = 0
  const newEvents: HistoryEvent[] = []

  for (let i = 0; i < ranges.length; i += MAX_INFLIGHT) {
    const batch = ranges.slice(i, i + MAX_INFLIGHT)
    const results = await Promise.all(batch.map(r => fetchChunk(r.from, r.to)))
    for (const chunk of results) newEvents.push(...chunk)
    done += batch.length

    // Checkpoint periodically so a failure resumes near where it stopped
    const shouldCheckpoint = done % CHECKPOINT_EVERY === 0 || done === total
    if (shouldCheckpoint) {
      const checkpointBlock = ranges[i + batch.length - 1].to
      const merged = dedup([..._state.events, ...newEvents])
      merged.sort((a, b) => Number(b.blockNumber - a.blockNumber) || b.logIndex - a.logIndex)
      saveCache(checkpointBlock, merged)
      setState({ events: merged, progress: done / total, syncing: true, syncedTo: checkpointBlock })
    } else {
      setState({ progress: done / total, syncing: true })
    }

    // Inter-chunk pacing — avoid flooding the public RPC
    if (i + MAX_INFLIGHT < ranges.length) {
      await new Promise(r => setTimeout(r, INTER_CHUNK_DELAY))
    }
  }

  // Final state after all batches
  setState({ syncing: false, progress: 1, error: null })
}

export async function syncHistory(force = false): Promise<void> {
  if (!CASCADE_ADDRESS) return

  // Concurrency guard: never run two syncs in parallel.
  // A forced sync arriving mid-run sets _pendingForce so it re-runs once the
  // current sync finishes — without overlapping or corrupting the checkpoint.
  if (_syncing) {
    if (force) _pendingForce = true
    return
  }
  _syncing     = true
  _pendingForce = false

  try {
    const client = getClient()
    const head = await client.getBlockNumber()

    const deployBlock = import.meta.env.VITE_CASCADE_DEPLOY_BLOCK
      ? BigInt(import.meta.env.VITE_CASCADE_DEPLOY_BLOCK as string)
      : head > 10_000n ? head - 10_000n : 0n

    const fromBlock = _state.syncedTo > 0n ? _state.syncedTo + 1n : deployBlock

    if (fromBlock > head) {
      setState({ syncing: false, progress: 1 })
      return
    }

    setState({ syncing: true, error: null })
    await syncFrom(fromBlock, head)
  } catch (e) {
    // Surface a clean, actionable message. Never dump raw RPC JSON.
    let msg = `${NETWORK_LABEL} is temporarily unavailable. Please retry shortly.`
    if (e instanceof Error) {
      const raw = e.message.toLowerCase()
      if (raw.includes('429') || raw.includes('rate') || raw.includes('too many')) {
        msg = `${NETWORK_LABEL} is busy right now. Please wait a moment and retry.`
      } else if (raw.includes('blocked') || raw.includes('err_blocked')) {
        msg = 'RPC request blocked by the browser. Check your ad-blocker settings or use the app on a supported browser.'
      } else if (e.message.length < 200) {
        msg = e.message
      }
    }
    setState({ syncing: false, error: msg })
  } finally {
    _syncing = false
    // If a forced sync was requested while we were running, re-run now that
    // we have released the lock — but only once (prevents infinite loop).
    if (_pendingForce) {
      _pendingForce = false
      void syncHistory(true)
    } else {
      schedulePoll()
    }
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
