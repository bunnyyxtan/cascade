/**
 * useGasEstimate — live Arc gas fee and per-call gas unit estimation.
 *
 * Arc uses USDC as its native gas token. The native balance and the ERC-20
 * balance are the same underlying pool at different decimal counts:
 *   - Native (18 dec):  used by eth_getBalance, msg.value, gas accounting
 *   - ERC-20  (6 dec):  used by balanceOf, approve, transferFrom
 *
 * Gas cost in native wei = gasUnits × maxFeePerGas
 * Gas cost in 6-dec ERC-20 units = ceil(nativeWei / 10^12)
 *
 * Ceiling division ensures the reserve never underestimates the actual cost.
 *
 * --- Gas unit estimation strategy ---
 *
 * Two layers:
 *
 * 1. Heuristic fallback (APPROVE_GAS_UNITS, CREATE_GAS_UNITS):
 *    Representative figures from Arc docs and observed on-chain behaviour.
 *    Used when form args are incomplete or per-call simulation is unavailable.
 *    NOT guaranteed upper bounds — real gas depends on calldata, storage state,
 *    and EVM version.
 *
 * 2. Per-call simulation (useEstimateApproveGas, useEstimateCreateGas):
 *    Calls eth_estimateGas with the actual sender, calldata, and chain.
 *    Returns the EVM's simulated gas units for the specific transaction.
 *    A SAFETY_MARGIN of 25% is added via ceiling arithmetic to cover:
 *      - Gas price movement between simulation and submission
 *      - Storage-state changes (another transaction settles in the same block)
 *      - Minor calldata variance
 *    The 25% margin is documented and applied explicitly; it is not hidden.
 *    Simulation can fail (RPC error, sender has insufficient balance at
 *    simulation time). On failure the hook returns undefined — callers fall
 *    back to the heuristic.
 *
 * --- Auto-advance race ---
 *
 * After approve confirmation the allowance refetch is async. The auto-advance
 * logic must observe the updated allowance value before calling createRoot.
 * See CreateRoot.tsx for the useEffect pattern that handles this.
 *
 * Ref: https://docs.arc.io/arc/references/gas-and-fees
 */

import { useEstimateFeesPerGas, useEstimateGas } from 'wagmi'
import { encodeFunctionData, erc20Abi } from 'viem'
import { cascadeAbi } from '@/lib/cascadeAbi'
import { CASCADE_ADDRESS, USDC_ADDRESS, TARGET_CHAIN_ID } from '@/lib/contracts'

// ── Heuristic gas unit estimates (Arc) ──────────────────────────────────────
// Representative figures used as fallback when per-call simulation is not
// available. NOT guaranteed upper bounds.

/** ERC-20 approve(): ~65,000 gas (Arc docs / observed) */
export const APPROVE_GAS_UNITS = 65_000n

/**
 * createRoot() gas estimate:
 *  - ERC-20 safeTransferFrom: ~65,000 gas
 *  - Contract storage writes (new root + USDC accounting): ~85,000 gas
 * Total: ~150,000 gas. Actual cost varies with state and calldata.
 */
export const CREATE_GAS_UNITS = 150_000n

/**
 * Safety margin applied to per-call simulation results: +25%.
 * Expressed as a multiplier numerator over 100 for integer arithmetic.
 * Applied as: ceil(units * 125 / 100).
 *
 * This covers:
 *   - Fee movement between simulation and on-chain execution
 *   - Storage-state changes settling in the same block
 *   - Minor calldata variance (e.g. string encoding differences)
 */
export const SAFETY_MARGIN_PCT = 125n  // 25% margin → multiply by 125/100

/** Factor to convert native 18-dec gas cost → 6-dec ERC-20 USDC units */
const NATIVE_TO_ERC20 = 10n ** 12n

/**
 * Convert a gas cost expressed in native wei (18 dec) to 6-decimal ERC-20
 * USDC units using ceiling division.
 *
 * Ceiling ensures the reserve never underestimates the actual cost. The
 * rounding error is at most 1 µUSDC (0.000001 USDC) per call.
 */
export function nativeGasCostToUsdc(gasUnits: bigint, maxFeePerGas: bigint): bigint {
  const nativeWei = gasUnits * maxFeePerGas
  return (nativeWei + NATIVE_TO_ERC20 - 1n) / NATIVE_TO_ERC20
}

/**
 * Apply the documented 25% safety margin to a simulated gas unit count.
 * Uses ceiling division so the result is always at least `units * 1.25`.
 *
 * Example: applyGasMargin(100n) = ceil(125 / 100) = 2n (for tiny values),
 *          applyGasMargin(100_000n) = ceil(12_500_000 / 100) = 125_000n.
 */
export function applyGasMargin(units: bigint): bigint {
  return (units * SAFETY_MARGIN_PCT + 99n) / 100n
}

// ── useEstimateFeesPerGas result type ────────────────────────────────────────

/** Result returned by useGasEstimate */
export interface GasEstimate {
  /** Live maxFeePerGas from the chain (native 18-dec wei). undefined while loading or on error. */
  maxFeePerGas:    bigint | undefined
  /**
   * Estimated gas reserve needed for one approve + one createRoot, expressed
   * in 6-decimal ERC-20 USDC units. undefined when maxFeePerGas is unknown.
   * Uses heuristic gas units (APPROVE + CREATE with no safety margin).
   * Use this for the conservative Max / spendableBalance calculation.
   */
  twoTxReserve:    bigint | undefined
  /**
   * Estimated gas reserve needed for one createRoot only (sufficient
   * allowance already exists), in 6-decimal ERC-20 USDC units.
   * Uses heuristic gas units (CREATE with no safety margin).
   */
  oneTxReserve:    bigint | undefined
  /** True while the RPC request is in flight. */
  isLoading:       boolean
  /** True when the RPC request has failed (no estimate available). */
  isError:         boolean
  /** Imperatively re-trigger the fee estimate. Offer this to the user on error. */
  refetch:         () => void
}

/**
 * Estimate Arc network fees and derive USDC gas reserves.
 *
 * Re-fetches automatically on a 15-second interval (Arc block time ~0.5 s).
 *
 * On failure the hook returns undefined reserves. Callers MUST treat undefined
 * as "do not proceed" — there is no raw-balance fallback.
 */
export function useGasEstimate(): GasEstimate {
  const { data, isLoading, isError, refetch } = useEstimateFeesPerGas({
    chainId: TARGET_CHAIN_ID,
    type: 'eip1559',
    query: {
      refetchInterval: 15_000,
      retry: 2,
      staleTime: 10_000,
    },
  })

  const maxFeePerGas = data?.maxFeePerGas

  const twoTxReserve = maxFeePerGas !== undefined
    ? nativeGasCostToUsdc(APPROVE_GAS_UNITS + CREATE_GAS_UNITS, maxFeePerGas)
    : undefined

  const oneTxReserve = maxFeePerGas !== undefined
    ? nativeGasCostToUsdc(CREATE_GAS_UNITS, maxFeePerGas)
    : undefined

  const retrigger = () => { void refetch() }
  return { maxFeePerGas, twoTxReserve, oneTxReserve, isLoading, isError, refetch: retrigger }
}

// ── Per-call gas simulation ──────────────────────────────────────────────────

/**
 * Per-call gas result: the simulated gas units with safety margin applied.
 * undefined when simulation is unavailable (loading, error, or args missing).
 */
export interface CallGasEstimate {
  /** Simulated gas units with SAFETY_MARGIN_PCT applied. undefined on error or loading. */
  gasUnits:  bigint | undefined
  isLoading: boolean
  /** True when simulation failed (RPC error, insufficient balance at simulation time, etc.). */
  isError:   boolean
}

/**
 * Estimate gas for `approve(CASCADE_ADDRESS, amount)` using eth_estimateGas
 * with the actual sender, calldata, and chain.
 *
 * Enabled only when account and amount are defined.
 * Returns undefined gasUnits on error — caller falls back to APPROVE_GAS_UNITS.
 */
export function useEstimateApproveGas(
  account: `0x${string}` | undefined,
  amount:  bigint | undefined,
): CallGasEstimate {
  const enabled = account !== undefined && amount !== undefined && amount > 0n

  const data = enabled
    ? encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [CASCADE_ADDRESS as `0x${string}`, amount] })
    : undefined

  const { data: rawUnits, isLoading, isError } = useEstimateGas({
    account,
    to:      USDC_ADDRESS,
    data,
    chainId: TARGET_CHAIN_ID,
    query: {
      enabled,
      staleTime: 30_000,
      retry:     1,
    },
  })

  const gasUnits = rawUnits !== undefined ? applyGasMargin(rawUnits) : undefined
  return { gasUnits, isLoading, isError }
}

/**
 * Estimate gas for `createRoot(manager, amount, delegation, deadline, title)`
 * using eth_estimateGas with the actual sender, calldata, and chain.
 *
 * Enabled only when all arguments are valid and non-zero.
 * Returns undefined gasUnits on error — caller falls back to CREATE_GAS_UNITS.
 *
 * Note: simulation requires the sender to have sufficient USDC allowance at
 * simulation time. If called before approval is confirmed, the simulation will
 * fail with a revert. This is expected and handled by the caller.
 */
export function useEstimateCreateGas(
  account:    `0x${string}` | undefined,
  manager:    string | undefined,
  amount:     bigint | undefined,
  delegation: bigint | undefined,
  deadline:   bigint | undefined,
  title:      string | undefined,
): CallGasEstimate {
  const { isAddress: _isAddr } = { isAddress: (s: string): s is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(s) }
  const argsValid =
    account !== undefined &&
    manager !== undefined && _isAddr(manager) &&
    amount !== undefined && amount > 0n &&
    delegation !== undefined && delegation <= amount &&
    deadline !== undefined && deadline > 0n &&
    title !== undefined && title.trim().length > 0

  const data = argsValid
    ? encodeFunctionData({
        abi:          cascadeAbi,
        functionName: 'createRoot',
        args:         [manager, amount, delegation, deadline, title.trim()],
      })
    : undefined

  const { data: rawUnits, isLoading, isError } = useEstimateGas({
    account,
    to:      CASCADE_ADDRESS as `0x${string}`,
    data,
    chainId: TARGET_CHAIN_ID,
    query: {
      enabled:   argsValid,
      staleTime: 30_000,
      retry:     1,
    },
  })

  const gasUnits = rawUnits !== undefined ? applyGasMargin(rawUnits) : undefined
  return { gasUnits, isLoading, isError }
}
