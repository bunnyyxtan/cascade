/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { CHAIN, makeTransport } from './lib/network'

export const config = createConfig({
  chains: [CHAIN, mainnet], // mainnet kept for ENS resolution
  connectors: [injected()],
  transports: {
    // All Arc reads go through the centralized transport (proxy-aware).
    [CHAIN.id]: makeTransport(),
    // ENS resolution uses Ethereum mainnet; not proxied (not blocked in practice).
    [mainnet.id]: http(),
  },
})
