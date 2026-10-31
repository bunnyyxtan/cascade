/**
 * Contract addresses and chain config for Cascade.
 * Update CASCADE_ADDRESS after deployment.
 */
import { CHAIN, CHAIN_ID } from './network'
import { getUsdc, buildTxExplorerUrl, buildAddressExplorerUrl } from '@/onchain-facts'

export const TARGET_CHAIN    = CHAIN
export const TARGET_CHAIN_ID = CHAIN_ID

// Set to the deployed contract address after deployment.
// Until then, the app shows a "not deployed" state.
export const CASCADE_ADDRESS = (
  import.meta.env.VITE_CASCADE_ADDRESS ?? ''
) as `0x${string}` | ''

export const usdcFact = getUsdc(TARGET_CHAIN_ID)
export const USDC_ADDRESS = (usdcFact?.address ?? '') as `0x${string}`
export const USDC_DECIMALS = usdcFact?.decimals ?? 6

export const isDeployed = CASCADE_ADDRESS.startsWith('0x') && CASCADE_ADDRESS.length === 42

export function txUrl(hash: `0x${string}`) {
  return buildTxExplorerUrl(TARGET_CHAIN_ID, hash)
}

export function addrUrl(addr: string) {
  return buildAddressExplorerUrl(TARGET_CHAIN_ID, addr)
}
