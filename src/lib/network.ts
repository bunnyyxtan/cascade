/**
 * network.ts — single source of truth for the active Arc network and RPC transport.
 *
 * Set VITE_NETWORK=mainnet to switch to Arc Mainnet (default: testnet).
 *
 * RPC transport priority (applied in makeTransport()):
 *   1. Vercel same-origin proxy  — when VITE_VERCEL_RPC_PROXY=1
 *      Proxies reads through /api/rpc, bypassing browser ad-blocker rules
 *      that target public RPC hostnames like rpc.mainnet.arc.io.
 *   2. Arc Studio proxy          — when VITE_RPC_PROXY_BASE_URL is set (Studio sessions)
 *   3. Public RPC                — development fallback (may be blocked in production)
 *
 * The wallet's own signing and submission calls are NOT routed through this
 * transport — they use the wallet provider's own RPC endpoint directly.
 *
 * DEPLOYMENT CHECKLIST (Vercel):
 *   - Set  ARC_RPC_URL=https://rpc.mainnet.arc.io       (server-side, not VITE_)
 *   - Set  VITE_VERCEL_RPC_PROXY=1                      (browser-visible signal)
 *   - Set  VITE_NETWORK, VITE_CASCADE_ADDRESS, etc.     (existing vars, unchanged)
 */

import { defineChain, http } from 'viem'
import type { HttpTransport } from 'viem'
import { requireChain } from '@/onchain-facts'

// ── Network selection ─────────────────────────────────────────────────────────

export const IS_MAINNET = (import.meta.env.VITE_NETWORK as string | undefined) === 'mainnet'

// Arc Testnet chain ID = 5042002, Arc Mainnet chain ID = 5042
const CHAIN_ID_VALUE = IS_MAINNET ? 5042 : 5042002

const fact = requireChain(CHAIN_ID_VALUE)

// ── Viem chain object built entirely from onchain-facts ───────────────────────

export const CHAIN = defineChain({
  id: fact.chainId,
  name: fact.name,
  nativeCurrency: {
    name: fact.nativeCurrency.symbol,
    symbol: fact.nativeCurrency.symbol,
    decimals: fact.nativeCurrency.decimals,
  },
  rpcUrls: {
    default: { http: fact.rpcUrls as [string, ...string[]] },
  },
  blockExplorers: {
    default: { name: fact.name, url: fact.explorerBase },
  },
  testnet: fact.isTestnet,
})

// ── Convenience exports ───────────────────────────────────────────────────────

export const CHAIN_ID: number = fact.chainId

/** Human-readable label: "Arc Testnet" or "Arc Mainnet". */
export const NETWORK_LABEL: string = fact.name

/** "ARC TESTNET" or "ARC MAINNET" — for topbar chips and kickers. */
export const NETWORK_LABEL_UPPER: string = fact.name.toUpperCase()

/** Switch prompt: "Switch to Arc Testnet" or "Switch to Arc Mainnet". */
export const SWITCH_TO_LABEL: string = `Switch to ${fact.name}`

// ── RPC URL (legacy — kept for compatibility, prefer makeTransport()) ─────────

const PROXY_KEY   = IS_MAINNET ? 'Arc' : 'Arc_Testnet'
const proxyBase   = import.meta.env.VITE_RPC_PROXY_BASE_URL as string | undefined
const proxyToken  = import.meta.env.VITE_RPC_PROXY_TOKEN   as string | undefined
const proxyChains = (import.meta.env.VITE_RPC_PROXY_CHAINS as string | undefined)?.split(',') ?? []

/** Public RPC URL from onchain-facts. May be blocked by browser ad-blockers in production. */
export const PUBLIC_RPC_URL: string = fact.rpcUrls[0] ?? ''

/** Arc Studio proxy URL when available, otherwise the public RPC URL. */
export const RPC_URL: string =
  proxyBase && proxyChains.includes(PROXY_KEY)
    ? `${proxyBase}/api/rpc/${PROXY_KEY}?_rpc_token=${proxyToken}`
    : PUBLIC_RPC_URL

// ── Transport factory ─────────────────────────────────────────────────────────

/**
 * Whether the Vercel same-origin JSON-RPC proxy is available.
 *
 * The proxy routes browser reads through /api/rpc (same-origin), avoiding
 * net::ERR_BLOCKED_BY_CLIENT errors from ad-blockers targeting public RPC
 * hostnames. Set VITE_VERCEL_RPC_PROXY=1 in the Vercel project settings.
 */
export const VERCEL_PROXY_ACTIVE =
  (import.meta.env.VITE_VERCEL_RPC_PROXY as string | undefined) === '1'

/**
 * The RPC URL actually used for frontend reads, in priority order:
 *   1. /api/rpc  — Vercel same-origin proxy (VITE_VERCEL_RPC_PROXY=1)
 *   2. Arc Studio proxy (VITE_RPC_PROXY_BASE_URL set)
 *   3. Public RPC (dev fallback, may be blocked in browsers)
 */
export const EFFECTIVE_RPC_URL: string = VERCEL_PROXY_ACTIVE
  ? '/api/rpc'
  : RPC_URL

/**
 * Create a viem HTTP transport using the configured RPC strategy.
 *
 * All Wagmi transports and standalone Viem public clients MUST call this
 * factory rather than constructing their own http() calls. This ensures:
 *   - A single, consistent transport selection point.
 *   - Bounded retries (3) with backoff.
 *   - A 10 s fetch timeout.
 *   - Correct URL selection for Vercel, Studio, and dev environments.
 *
 * The wallet's signing path is not affected — ConnectKit/wagmi uses the
 * wallet provider's own RPC for eth_sendRawTransaction etc.
 */
export function makeTransport(): HttpTransport {
  return http(EFFECTIVE_RPC_URL, {
    // Retry up to 3 times on transient errors (does not retry on 4xx)
    retryCount: 3,
    retryDelay: 1_000,
    // Fetch timeout; the Vercel proxy enforces its own 10 s upstream timeout
    timeout: 12_000,
  })
}

// ── Shared public client ──────────────────────────────────────────────────────

/**
 * Lazily-created viem public client singleton.
 *
 * All standalone viem reads (history.ts, configCheck.ts, blockTimestamps.ts)
 * use this client rather than creating their own. This keeps transport
 * selection in one place and avoids duplicated client construction overhead.
 *
 * The client is created on first call so module initialisation stays cheap.
 */
import { createPublicClient } from 'viem'

let _client: ReturnType<typeof createPublicClient> | null = null

export function getPublicClient(): ReturnType<typeof createPublicClient> {
  if (!_client) {
    _client = createPublicClient({ chain: CHAIN, transport: makeTransport() })
  }
  return _client
}
