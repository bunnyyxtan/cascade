/**
 * Query invalidation helpers.
 * Invalidates wagmi read cache entries by function name so UI refreshes
 * automatically after confirmed writes without brittle setTimeout polls.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'

export function useInvalidateCommitment() {
  const qc = useQueryClient()
  return useCallback(
    () => {
      // Invalidate all Cascade read queries: getCommitment, getChildren, nextId, totals, claimable
      void qc.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === 'object' && k !== null && 'functionName' in (k)) })
    },
    [qc],
  )
}

export function useInvalidateUsdcBalance() {
  const qc = useQueryClient()
  return useCallback(
    () => {
      void qc.invalidateQueries({ predicate: (q) => q.queryKey.some((k) => typeof k === 'object' && k !== null && 'functionName' in (k) && (k as { functionName: string }).functionName === 'balanceOf') })
    },
    [qc],
  )
}
