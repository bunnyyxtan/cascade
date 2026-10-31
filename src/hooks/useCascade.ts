/**
 * Core read hooks for Cascade contract state.
 */
import { useReadContract, useReadContracts } from 'wagmi'
import { cascadeAbi } from '@/lib/cascadeAbi'
import { CASCADE_ADDRESS, TARGET_CHAIN_ID, isDeployed } from '@/lib/contracts'
import type { Commitment } from '@/lib/types'

// wagmi v2 returns the tuple as a named-field object when the ABI has components
type RawCommitment = {
  id: bigint; parentId: bigint; manager: `0x${string}`; approver: `0x${string}`; client: `0x${string}`
  budget: bigint; remaining: bigint; delegationLimit: bigint; allocated: bigint; deadline: bigint
  depth: number; childCount: number; state: number; failReason: number; title: string; deliveryRef: string
}

function rawToCommitment(raw: unknown): Commitment {
  const r = raw as RawCommitment
  return {
    id: r.id, parentId: r.parentId, manager: r.manager, approver: r.approver, client: r.client,
    budget: r.budget, remaining: r.remaining, delegationLimit: r.delegationLimit, allocated: r.allocated,
    deadline: r.deadline, depth: r.depth, childCount: r.childCount,
    state: r.state, failReason: r.failReason, title: r.title, deliveryRef: r.deliveryRef,
  }
}

export function useCommitment(id: bigint | undefined) {
  const result = useReadContract({
    address: CASCADE_ADDRESS as `0x${string}`,
    abi: cascadeAbi,
    functionName: 'getCommitment',
    args: id !== undefined ? [id] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: isDeployed && id !== undefined && id > 0n },
  })

  const raw = result.data ? rawToCommitment(result.data) : undefined
  return {
    ...result,
    // id=0 means the contract returned an empty/uninitialized struct — treat as not found
    commitment: raw && raw.id > 0n ? raw : undefined,
  }
}

export function useChildren(parentId: bigint | undefined) {
  return useReadContract({
    address: CASCADE_ADDRESS as `0x${string}`,
    abi: cascadeAbi,
    functionName: 'getChildren',
    args: parentId !== undefined ? [parentId] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: isDeployed && parentId !== undefined },
  })
}

export function useNextId() {
  return useReadContract({
    address: CASCADE_ADDRESS as `0x${string}`,
    abi: cascadeAbi,
    functionName: 'nextId',
    chainId: TARGET_CHAIN_ID,
    query: { enabled: isDeployed },
  })
}

export function useClaimable(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CASCADE_ADDRESS as `0x${string}`,
    abi: cascadeAbi,
    functionName: 'claimable',
    args: address ? [address] : undefined,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: isDeployed && !!address },
  })
}

export function useTotals() {
  const { data, ...rest } = useReadContracts({
    contracts: [
      { address: CASCADE_ADDRESS as `0x${string}`, abi: cascadeAbi, functionName: 'totalEscrowed', chainId: TARGET_CHAIN_ID },
      { address: CASCADE_ADDRESS as `0x${string}`, abi: cascadeAbi, functionName: 'totalClaimable', chainId: TARGET_CHAIN_ID },
      { address: CASCADE_ADDRESS as `0x${string}`, abi: cascadeAbi, functionName: 'contractBalance', chainId: TARGET_CHAIN_ID },
    ],
    query: { enabled: isDeployed },
  })
  return {
    ...rest,
    totalEscrowed: data?.[0]?.result,
    totalClaimable: data?.[1]?.result,
    contractBalance: data?.[2]?.result,
  }
}

/** Fetch an array of commitment ids in parallel and return them all. */
export function useCommitments(ids: bigint[]) {
  const { data, ...rest } = useReadContracts({
    contracts: ids.map((id) => ({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'getCommitment',
      args: [id],
      chainId: TARGET_CHAIN_ID,
    })),
    query: { enabled: isDeployed && ids.length > 0 },
  })
  const commitments = data
    ?.map((r) => (r.result ? rawToCommitment(r.result) : undefined))
    .filter((c): c is Commitment => c !== undefined && c.id > 0n)
  return { ...rest, commitments }
}
