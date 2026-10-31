/**
 * Block timestamp cache — module singleton.
 *
 * Fetches `eth_getBlockByNumber` (headers only) for any block whose timestamp
 * is not yet known, at most MAX_INFLIGHT requests in flight at a time.
 * Caches to localStorage as a JSON map of blockNumber(decimal) → unixSeconds.
 *
 * Design:
 *   - First Activity load: N unique block numbers from the synced event list.
 *     We batch them in groups of MAX_INFLIGHT (4). On a full history of, say,
 *     200 events across 150 unique blocks, that is ~38 round-trips on first load.
 *     After that, the whole map is in localStorage and every subsequent visit
 *     only fetches blocks that arrived since the last visit — typically 0–5.
 *   - useSyncExternalStore so React re-renders when new timestamps arrive.
 *   - Fully independent of history.ts; shares the same RPC URL.
 */

import { createPublicClient, http } from 'viem'
import { useSyncExternalStore, useEffect } from 'react'
import { CHAIN, CHAIN_ID, RPC_URL } from './network'
import { CASCADE_ADDRESS } from './contracts'

// ── Types ─────────────────────────────────────────────────────────────────────

/** blockNumber (bigint) → unix timestamp in seconds */
export type BlockTsMap = Map<bigint, number>

// ── Cache ─────────────────────────────────────────────────────────────────────

const TS_CACHE_KEY = `cascade:block-ts:${CHAIN_ID}:${CASCADE_ADDRESS?.toLowerCase() ?? 'none'}`
const MAX_INFLIGHT  = 4

function loadTsCache(): BlockTsMap {
  try {
    const raw = localStorage.getItem(TS_CACHE_KEY)
    if (!raw) return new Map()
    const obj = JSON.parse(raw) as Record<string, number>
    return new Map(Object.entries(obj).map(([k, v]) => [BigInt(k), v]))
  } catch { return new Map() }
}

function saveTsCache(map: BlockTsMap) {
  try {
    const obj: Record<string, number> = {}
    for (const [k, v] of map) obj[k.toString()] = v
    localStorage.setItem(TS_CACHE_KEY, JSON.stringify(obj))
  } catch { /* quota exceeded */ }
}

// ── Store internals ───────────────────────────────────────────────────────────

let _map: BlockTsMap = loadTsCache()
const _listeners  = new Set<() => void>()
const _fetching   = new Set<bigint>()

function notify() { _listeners.forEach(l => l()) }

function getClient() {
  return createPublicClient({ chain: CHAIN, transport: http(RPC_URL) })
}

async function fetchBatch(blocks: bigint[]) {
  const client = getClient()
  await Promise.allSettled(blocks.map(async bn => {
    try {
      const block = await client.getBlock({ blockNumber: bn, includeTransactions: false })
      _map = new Map(_map)
      _map.set(bn, Number(block.timestamp))
    } catch { /* leave blank — will retry next render */ }
    _fetching.delete(bn)
  }))
  saveTsCache(_map)
  notify()
}

/** Request timestamps for a set of block numbers. Missing ones are fetched. */
export function requestTimestamps(blockNumbers: bigint[]) {
  const needed = blockNumbers.filter(bn => !_map.has(bn) && !_fetching.has(bn))
  if (needed.length === 0) return

  for (const bn of needed) _fetching.add(bn)

  // Batch into groups of MAX_INFLIGHT
  for (let i = 0; i < needed.length; i += MAX_INFLIGHT) {
    const batch = needed.slice(i, i + MAX_INFLIGHT)
    void fetchBatch(batch)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getTsSnapshot(): BlockTsMap { return _map }

export function subscribeTsStore(listener: () => void): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

// ── React hook ─────────────────────────────────────────────────────────────────

/**
 * Returns the current BlockTsMap and triggers fetches for any missing blocks.
 * Re-renders when new timestamps arrive.
 */
export function useBlockTimestamps(blockNumbers: bigint[]): BlockTsMap {
  const map = useSyncExternalStore(subscribeTsStore, getTsSnapshot, getTsSnapshot)

  useEffect(() => {
    requestTimestamps(blockNumbers)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockNumbers.length])

  return map
}
