/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { CHAIN, RPC_URL } from './lib/network'

export const config = createConfig({
  chains: [CHAIN, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [CHAIN.id]: http(RPC_URL),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
