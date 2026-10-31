/**
 * configCheck.ts — module singleton that verifies the deployed contract at startup.
 *
 * Checks (all must pass for status === 'ok'):
 *   1. eth_chainId from RPC_URL equals CHAIN_ID
 *   2. keccak256(eth_getCode(CASCADE_ADDRESS)) equals VITE_CASCADE_CODEHASH
 *   3. Cascade.usdc() equals the onchain-facts USDC address for CHAIN_ID
 *
 * If VITE_CASCADE_CODEHASH is absent → status 'unverified' (not 'ok').
 * Any RPC timeout (>10 s) or failure → status 'error'.
 *
 * Re-runs:
 *   - When the tab becomes visible after >5 minutes of being hidden.
 *   - When explicitly triggered via retryConfigCheck().
 *
 * The result key is `${CHAIN_ID}:${CASCADE_ADDRESS.toLowerCase()}:${CODEHASH}`.
 * Writes are allowed only when status === 'ok' AND key matches the current key.
 */

import { createPublicClient, http, keccak256 } from 'viem'
import { useSyncExternalStore, useEffect } from 'react'
import { CHAIN, CHAIN_ID, RPC_URL } from './network'
import { CASCADE_ADDRESS, USDC_ADDRESS, isDeployed } from './contracts'
import { cascadeAbi } from './cascadeAbi'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConfigCheckStatus =
  | 'loading'
  | 'ok'
  | 'mismatch'
  | 'not-deployed'
  | 'unverified'   // codehash env var absent
  | 'error'        // RPC failure or timeout

export interface ConfigCheckResult {
  status: ConfigCheckStatus
  /** Stable key: `${CHAIN_ID}:${address}:${codehash}` — callers must compare. */
  key: string
  checkedAt: number    // Date.now() when check completed, 0 while loading
  detail?: string
  expected?: string
  actual?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPECTED_CODEHASH = (
  import.meta.env.VITE_CASCADE_CODEHASH as string | undefined
)?.toLowerCase() ?? ''

const EXPECTED_KEY = `${CHAIN_ID}:${CASCADE_ADDRESS.toLowerCase()}:${EXPECTED_CODEHASH}`

const RPC_TIMEOUT_MS = 10_000
const REHIDE_THRESHOLD_MS = 5 * 60 * 1000   // 5 minutes

// ── Singleton state ───────────────────────────────────────────────────────────

let _state: ConfigCheckResult = {
  status: 'loading',
  key: EXPECTED_KEY,
  checkedAt: 0,
}

const _listeners = new Set<() => void>()
let _running = false
let _hiddenAt = 0

function setState(patch: Partial<ConfigCheckResult>) {
  _state = { ..._state, ...patch }
  _listeners.forEach(l => l())
}

// ── RPC call with timeout ─────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`RPC call timed out after ${ms / 1000}s`)), ms),
    ),
  ])
}

// ── Core check ────────────────────────────────────────────────────────────────

export async function runConfigCheck(): Promise<void> {
  if (_running) return
  _running = true
  setState({ status: 'loading', checkedAt: 0 })

  try {
    if (!isDeployed || !CASCADE_ADDRESS) {
      setState({ status: 'not-deployed', checkedAt: Date.now(), detail: 'VITE_CASCADE_ADDRESS is not set.' })
      return
    }

    const client = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) })
    const addr = CASCADE_ADDRESS

    // Check 1: eth_chainId — verify we're talking to the right network
    const onchainChainId = await withTimeout(client.getChainId(), RPC_TIMEOUT_MS)
    if (onchainChainId !== CHAIN_ID) {
      setState({
        status: 'mismatch',
        checkedAt: Date.now(),
        expected: `chain ${CHAIN_ID}`,
        actual: `chain ${onchainChainId}`,
        detail: 'The RPC endpoint is on a different chain than configured.',
      })
      return
    }

    // Check 2: eth_getCode + keccak256 — verify bytecode identity
    const code = await withTimeout(client.getCode({ address: addr }), RPC_TIMEOUT_MS)
    if (!code || code === '0x') {
      setState({ status: 'not-deployed', checkedAt: Date.now(), detail: 'No bytecode at the configured address.' })
      return
    }

    if (!EXPECTED_CODEHASH) {
      // Codehash env var absent — reads work, writes gated as 'unverified'
      // Still run usdc() check so a wrong-usdc mismatch is caught.
      const usdcOnChain = await withTimeout(
        client.readContract({ address: addr, abi: cascadeAbi, functionName: 'usdc' }) as Promise<string>,
        RPC_TIMEOUT_MS,
      )
      const expectedUsdc = USDC_ADDRESS.toLowerCase()
      const actualUsdc = usdcOnChain.toLowerCase()
      if (expectedUsdc && actualUsdc !== expectedUsdc) {
        setState({
          status: 'mismatch',
          checkedAt: Date.now(),
          expected: `usdc()=${USDC_ADDRESS}`,
          actual: `usdc()=${usdcOnChain}`,
          detail: 'Contract deployed with wrong USDC address.',
        })
        return
      }
      setState({ status: 'unverified', checkedAt: Date.now(), detail: 'VITE_CASCADE_CODEHASH is not set; bytecode not verified.' })
      return
    }

    const actualCodehash = keccak256(code).toLowerCase()
    if (actualCodehash !== EXPECTED_CODEHASH) {
      setState({
        status: 'mismatch',
        checkedAt: Date.now(),
        expected: `codehash=${EXPECTED_CODEHASH}`,
        actual: `codehash=${actualCodehash}`,
        detail: 'Deployed bytecode does not match VITE_CASCADE_CODEHASH.',
      })
      return
    }

    // Check 3: Cascade.usdc() — verify USDC address
    const usdcOnChain = await withTimeout(
      client.readContract({ address: addr, abi: cascadeAbi, functionName: 'usdc' }) as Promise<string>,
      RPC_TIMEOUT_MS,
    )
    const expectedUsdc = USDC_ADDRESS.toLowerCase()
    const actualUsdc = usdcOnChain.toLowerCase()
    if (expectedUsdc && actualUsdc !== expectedUsdc) {
      setState({
        status: 'mismatch',
        checkedAt: Date.now(),
        expected: `usdc()=${USDC_ADDRESS}`,
        actual: `usdc()=${usdcOnChain}`,
        detail: 'Contract deployed with wrong USDC address.',
      })
      return
    }

    setState({ status: 'ok', checkedAt: Date.now() })
  } catch (e) {
    setState({
      status: 'error',
      checkedAt: Date.now(),
      detail: e instanceof Error ? e.message : String(e),
    })
  } finally {
    _running = false
  }
}

/** Kick off a fresh check (cancels nothing — just forces re-run). */
export function retryConfigCheck(): void {
  _running = false
  void runConfigCheck()
}

// ── useSyncExternalStore wiring ───────────────────────────────────────────────

export function getConfigSnapshot(): ConfigCheckResult { return _state }

export function subscribeConfig(listener: () => void): () => void {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

/** Returns the current result and boots the check on first mount. */
export function useConfigCheck(): ConfigCheckResult {
  const result = useSyncExternalStore(subscribeConfig, getConfigSnapshot, getConfigSnapshot)

  useEffect(() => {
    // Initial run
    void runConfigCheck()

    // Re-run when tab regains visibility after >5 minutes
    function onVisible() {
      if (document.visibilityState !== 'hidden') {
        const elapsed = Date.now() - _hiddenAt
        if (elapsed > REHIDE_THRESHOLD_MS) void runConfigCheck()
      } else {
        _hiddenAt = Date.now()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  return result
}

/** The key the current env expects. Used by callers to validate result.key. */
export const EXPECTED_CONFIG_KEY = EXPECTED_KEY

/**
 * Hook for the wallet chainId → re-run trigger.
 * Call this once near the app root to re-verify whenever the wallet switches
 * to CHAIN_ID (e.g. after a chain switch prompt succeeds).
 */
export function useChainIdWatcher(walletChainId: number | undefined): void {
  useEffect(() => {
    if (walletChainId === CHAIN_ID) {
      // Wallet just connected to the right chain — re-verify
      void runConfigCheck()
    }
  // Only re-trigger when chainId changes to CHAIN_ID
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletChainId])
}
