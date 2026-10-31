/**
 * WalletToastWatcher — fires toasts on wallet connect/disconnect/network-switch.
 * Rendered once at root level. Uses useAccountEffect from wagmi.
 */
import { useAccountEffect, useSwitchChain, useAccount } from 'wagmi'
import { useEffect, useRef } from 'react'
import { toastConnected, toastDisconnected, toastNetworkSwitched } from '@/lib/toast'

export default function WalletToastWatcher() {
  const { chainId } = useAccount()
  const prevChainId  = useRef<number | undefined>(undefined)
  const { chains }   = useSwitchChain()

  /* Connect / disconnect — skip toast on silent reconnect (page reload) */
  useAccountEffect({
    onConnect({ address, isReconnected }) {
      if (!isReconnected) toastConnected(address)
    },
    onDisconnect() {
      toastDisconnected()
    },
  })

  /* Network switch — fire when chainId changes while connected */
  useEffect(() => {
    if (prevChainId.current !== undefined && chainId !== undefined && chainId !== prevChainId.current) {
      const name = chains.find(c => c.id === chainId)?.name ?? `chain ${chainId}`
      toastNetworkSwitched(name)
    }
    prevChainId.current = chainId
  }, [chainId, chains])

  return null
}
