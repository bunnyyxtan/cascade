/**
 * network.ts — single source of truth for the active Arc network.
 *
 * Set VITE_NETWORK=mainnet to switch to Arc Mainnet.
 * Default is testnet.
 *
 * All chain facts are read from onchain-facts.ts — nothing is hardcoded here.
 */

import { defineChain } from 'viem'
import { requireChain } from '@/onchain-facts'

// ── Network selection ────────────────────────────────────────────────────────

export const IS_MAINNET = (import.meta.env.VITE_NETWORK as string | undefined) === 'mainnet'

// Arc Testnet chain ID = 5042002, Arc Mainnet chain ID = 5042
const CHAIN_ID_VALUE = IS_MAINNET ? 5042 : 5042002

const fact = requireChain(CHAIN_ID_VALUE)

// ── Viem chain object built entirely from onchain-facts ──────────────────────

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

// ── Convenience exports ──────────────────────────────────────────────────────

export const CHAIN_ID: number = fact.chainId

/** Human-readable label: "Arc Testnet" or "Arc Mainnet". */
export const NETWORK_LABEL: string = fact.name

/** "ARC TESTNET" or "ARC MAINNET" — for topbar chips and kickers. */
export const NETWORK_LABEL_UPPER: string = fact.name.toUpperCase()

/** Switch prompt: "Switch to Arc Testnet" or "Switch to Arc Mainnet". */
export const SWITCH_TO_LABEL: string = `Switch to ${fact.name}`

// ── RPC URL ──────────────────────────────────────────────────────────────────
// Use Studio proxy key when this chain is listed; otherwise fall back to the
// public RPC URL from onchain-facts.

const PROXY_KEY = IS_MAINNET ? 'Arc' : 'Arc_Testnet'
const proxyBase = import.meta.env.VITE_RPC_PROXY_BASE_URL as string | undefined
const proxyToken = import.meta.env.VITE_RPC_PROXY_TOKEN as string | undefined
const proxyChains = (import.meta.env.VITE_RPC_PROXY_CHAINS as string | undefined)?.split(',') ?? []

export const RPC_URL: string =
  proxyBase && proxyChains.includes(PROXY_KEY)
    ? `${proxyBase}/api/rpc/${PROXY_KEY}?_rpc_token=${proxyToken}`
    : (fact.rpcUrls[0] ?? '')
