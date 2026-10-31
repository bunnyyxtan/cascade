/**
 * Write hooks for every state-changing Cascade action.
 *
 * useSuccessOnce — fires a callback exactly once per confirmed transaction.
 * It tracks the last-seen receipt hash in a ref so the callback does not
 * re-fire on unrelated re-renders, and does not require suppressing
 * exhaustive-deps lint rules.
 */
import { useRef, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEventLogs } from 'viem'
import { cascadeAbi } from '@/lib/cascadeAbi'
import { CASCADE_ADDRESS, TARGET_CHAIN_ID } from '@/lib/contracts'

/** Fires `cb` at most once per unique confirmed receipt hash. */
export function useSuccessOnce(
  isSuccess: boolean,
  receiptHash: `0x${string}` | undefined,
  cb: (() => void) | undefined,
) {
  const firedFor = useRef<`0x${string}` | undefined>(undefined)
  useEffect(() => {
    if (isSuccess && receiptHash && receiptHash !== firedFor.current && cb) {
      firedFor.current = receiptHash
      cb()
    }
  }, [isSuccess, receiptHash, cb])
}

function useAction() {
  const { writeContract, data: hash, isPending, isError, error, reset } = useWriteContract()
  const {
    isLoading: isConfirming,
    isSuccess,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash, chainId: TARGET_CHAIN_ID })
  return { writeContract, hash, isPending, isConfirming, isSuccess, isError, error, reset, receipt }
}

export function useCreateRoot() {
  const state = useAction()
  const createRoot = (args: {
    manager: `0x${string}`
    amount: bigint
    delegationLimit: bigint
    deadline: bigint
    title: string
  }) => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'createRoot',
      args: [args.manager, args.amount, args.delegationLimit, args.deadline, args.title],
      chainId: TARGET_CHAIN_ID,
    })
  }
  return { ...state, createRoot }
}

export function useCreateChild() {
  const state = useAction()
  const createChild = (args: {
    parentId: bigint
    manager: `0x${string}`
    amount: bigint
    deadline: bigint
    title: string
  }) => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'createChild',
      args: [args.parentId, args.manager, args.amount, args.deadline, args.title],
      chainId: TARGET_CHAIN_ID,
    })
  }

  /** Decode the ChildCreated event from the confirmed receipt and return the new id. */
  function decodeNewChildId(): bigint | undefined {
    if (!state.receipt) return undefined
    try {
      const logs = parseEventLogs({
        abi: cascadeAbi,
        logs: state.receipt.logs,
        eventName: 'ChildCreated',
      })
      const id = (logs[0]?.args as { id?: bigint } | undefined)?.id
      return id
    } catch {
      return undefined
    }
  }

  return { ...state, createChild, decodeNewChildId }
}

export function useSubmit() {
  const state = useAction()
  const submit = (id: bigint, deliveryRef: string) => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'submit',
      args: [id, deliveryRef],
      chainId: TARGET_CHAIN_ID,
    })
  }
  return { ...state, submit }
}

export function useApprove() {
  const state = useAction()
  const approve = (id: bigint) => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'approve',
      args: [id],
      chainId: TARGET_CHAIN_ID,
    })
  }
  return { ...state, approve }
}

export function useReject() {
  const state = useAction()
  const reject = (id: bigint) => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'reject',
      args: [id],
      chainId: TARGET_CHAIN_ID,
    })
  }
  return { ...state, reject }
}

export function useCancel() {
  const state = useAction()
  const cancel = (id: bigint) => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'cancel',
      args: [id],
      chainId: TARGET_CHAIN_ID,
    })
  }
  return { ...state, cancel }
}

export function useExpire() {
  const state = useAction()
  const expire = (id: bigint) => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'expire',
      args: [id],
      chainId: TARGET_CHAIN_ID,
    })
  }
  return { ...state, expire }
}

export function useClaim() {
  const state = useAction()
  const claim = () => {
    state.writeContract({
      address: CASCADE_ADDRESS as `0x${string}`,
      abi: cascadeAbi,
      functionName: 'claim',
      args: [],
      chainId: TARGET_CHAIN_ID,
    })
  }
  return { ...state, claim }
}
