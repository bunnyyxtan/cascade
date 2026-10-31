import { useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { USDC_ADDRESS, TARGET_CHAIN_ID } from '@/lib/contracts'

/**
 * Read the ERC-20 USDC balance for an address.
 * On Arc, the ERC-20 view (6 decimals) is the correct one to show users.
 * Never use useBalance (18-decimal native view) alongside this.
 */
export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!address && !!USDC_ADDRESS },
  })
}

export function useUsdcAllowance(owner: `0x${string}` | undefined, spender: `0x${string}` | undefined) {
  return useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: !!owner && !!spender && !!USDC_ADDRESS },
  })
}
