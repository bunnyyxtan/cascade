/**
 * useCascadeActivity and useWalletCommitmentIds — backed by the history store.
 *
 * Signatures are unchanged from Stage 5. Internal MAX_LOOKBACK is replaced by
 * the store's full history (from VITE_CASCADE_DEPLOY_BLOCK).
 */

import { useSyncExternalStore, useEffect } from 'react'
import { subscribe, getSnapshot, syncHistory, eventsFor, type HistoryEvent } from '@/lib/history'

export type { HistoryEvent as ActivityEvent }
export type CascadeEventName = string

// ── useCascadeActivity ────────────────────────────────────────────────────────

export function useCascadeActivity(commitmentId?: bigint) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => { void syncHistory() }, [])

  const all = state.events

  const events = commitmentId !== undefined ? eventsFor(commitmentId) : all

  return {
    events,
    isLoading: state.syncing && events.length === 0,
    syncing: state.syncing,
    progress: state.progress,
    error: state.error ? new Error(state.error) : null,
    refetch: () => syncHistory(true),
  }
}

// ── useWalletCommitmentIds ────────────────────────────────────────────────────

export function useWalletCommitmentIds(address: `0x${string}` | undefined) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => { void syncHistory() }, [])

  if (!address) return { ids: [], isLoading: false, refetch: () => syncHistory(true) }

  const addrLc = address.toLowerCase()
  const seen = new Set<bigint>()

  for (const ev of state.events) {
    const a = ev.args
    function aStr(k: string): string {
      const v = a[k]
      return typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean' ? String(v) : ''
    }
    function aBigInt(k: string): bigint | undefined {
      const v = a[k]
      try { return BigInt(typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' ? String(v) : '0') } catch { return undefined }
    }
    if (ev.eventName === 'RootCreated') {
      if (aStr('client').toLowerCase() === addrLc || aStr('manager').toLowerCase() === addrLc) {
        const id = aBigInt('id')
        if (id !== undefined) seen.add(id)
      }
    } else if (ev.eventName === 'ChildCreated') {
      if (aStr('manager').toLowerCase() === addrLc) {
        const id = aBigInt('id')
        if (id !== undefined) seen.add(id)
      }
    }
  }

  const ids = [...seen].sort((a, b) => (a < b ? 1 : -1))

  return {
    ids,
    isLoading: state.syncing && ids.length === 0,
    refetch: () => syncHistory(true),
  }
}
