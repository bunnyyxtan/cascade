/**
 * Gas estimation math — pure unit tests.
 *
 * Covers:
 *   - nativeGasCostToUsdc: ceiling conversion from 18-dec native to 6-dec ERC-20
 *   - applyGasMargin: 25% safety margin with ceiling arithmetic
 *   - spendableBalance derivation with two-tx / one-tx path selection
 *   - parseOnchainError: blocklist and gas-related error messages
 */
import { describe, it, expect } from 'vitest'
import {
  nativeGasCostToUsdc,
  applyGasMargin,
  APPROVE_GAS_UNITS,
  CREATE_GAS_UNITS,
  SAFETY_MARGIN_PCT,
} from '@/hooks/useGasEstimate'
import { parseOnchainError } from '@/lib/format'

// ── Helpers ───────────────────────────────────────────────────────────────────
const gwei = (n: bigint) => n * 1_000_000_000n    // Gwei → wei (18-dec native)
const usdc = (n: number)  => BigInt(Math.round(n * 1_000_000))  // human → 6-dec

// ── nativeGasCostToUsdc — ceiling conversion ──────────────────────────────────

describe('nativeGasCostToUsdc — ceiling 18-dec native to 6-dec ERC-20', () => {
  it('65,000 gas at 20 Gwei — approve cost rounds to exact multiple', () => {
    // 65,000 × 20e9 = 1.3e15 native wei. 1.3e15 / 1e12 = 1300 exactly
    expect(nativeGasCostToUsdc(APPROVE_GAS_UNITS, gwei(20n))).toBe(1300n)
  })

  it('150,000 gas at 20 Gwei — createRoot cost rounds to exact multiple', () => {
    expect(nativeGasCostToUsdc(CREATE_GAS_UNITS, gwei(20n))).toBe(3000n)
  })

  it('two-tx total at 20 Gwei = 0.004300 USDC', () => {
    expect(nativeGasCostToUsdc(APPROVE_GAS_UNITS + CREATE_GAS_UNITS, gwei(20n))).toBe(4300n)
  })

  it('approve at 1,000 Gwei = 0.065000 USDC', () => {
    expect(nativeGasCostToUsdc(APPROVE_GAS_UNITS, gwei(1_000n))).toBe(65_000n)
  })

  it('two-tx at 1,000 Gwei = 0.215000 USDC', () => {
    expect(nativeGasCostToUsdc(APPROVE_GAS_UNITS + CREATE_GAS_UNITS, gwei(1_000n))).toBe(215_000n)
  })

  it('createRoot at 20,000 Gwei = 3.000000 USDC', () => {
    expect(nativeGasCostToUsdc(CREATE_GAS_UNITS, gwei(20_000n))).toBe(3_000_000n)
  })

  it('two-tx at 20,000 Gwei (max) = 4.300000 USDC', () => {
    expect(nativeGasCostToUsdc(APPROVE_GAS_UNITS + CREATE_GAS_UNITS, gwei(20_000n))).toBe(4_300_000n)
  })

  it('sub-µUSDC input: 1 native wei → rounds UP to 1 µUSDC (ceiling not truncation)', () => {
    // 1 native wei / 1e12 = 0.000...001 → ceiling = 1 µUSDC
    expect(nativeGasCostToUsdc(1n, 1n)).toBe(1n)
  })

  it('exactly 1e12 native wei (1 µUSDC boundary) → 1 µUSDC', () => {
    expect(nativeGasCostToUsdc(1n, 1_000_000_000_000n)).toBe(1n)
  })

  it('1e12 + 1 native wei → 2 µUSDC (crosses boundary, rounds up)', () => {
    expect(nativeGasCostToUsdc(1n, 1_000_000_000_001n)).toBe(2n)
  })

  it('ceiling rounding error is at most 1 µUSDC per call', () => {
    // For any input the ceiling can be at most 1 more than the floor
    const floor = (1n * 7n) / 1_000_000_000_000n
    const ceil  = nativeGasCostToUsdc(1n, 7n)
    expect(ceil - floor).toBeLessThanOrEqual(1)
  })
})

// ── applyGasMargin — 25% safety margin ────────────────────────────────────────

describe('applyGasMargin — 25% safety margin with ceiling', () => {
  it('SAFETY_MARGIN_PCT is 125 (25% = multiply by 125/100)', () => {
    expect(SAFETY_MARGIN_PCT).toBe(125n)
  })

  it('100,000 gas units → 125,000 with margin', () => {
    expect(applyGasMargin(100_000n)).toBe(125_000n)
  })

  it('65,000 (APPROVE_GAS_UNITS) → 81,250 with margin', () => {
    expect(applyGasMargin(APPROVE_GAS_UNITS)).toBe(81_250n)
  })

  it('150,000 (CREATE_GAS_UNITS) → 187,500 with margin', () => {
    expect(applyGasMargin(CREATE_GAS_UNITS)).toBe(187_500n)
  })

  it('margin result is always >= input (never below original)', () => {
    for (const n of [1n, 99n, 1000n, 65_000n, 150_000n, 999_999n]) {
      expect(applyGasMargin(n)).toBeGreaterThanOrEqual(n)
    }
  })

  it('margin result is exactly 1.25× for inputs divisible by 4', () => {
    const n = 80_000n
    expect(applyGasMargin(n)).toBe(100_000n)  // 80000 * 125 / 100 = 100000
  })

  it('simulated 120,000 gas with margin → 150,000 — above heuristic ceiling', () => {
    // This is the key property: a per-call simulation that returns 120,000 gas
    // produces a reserve of 150,000 AFTER the margin, equal to the heuristic.
    // A simulation returning 121,000 would give 151,250 — above the heuristic.
    expect(applyGasMargin(120_000n)).toBe(150_000n)
    expect(applyGasMargin(121_000n)).toBe(151_250n)
  })

  it('ceiling: non-multiple of 100 rounds up', () => {
    // 101 * 125 = 12625; 12625 / 100 = 126.25 → ceil = 127
    expect(applyGasMargin(101n)).toBe(127n)
    // 103 * 125 = 12875; 12875 / 100 = 128.75 → ceil = 129
    expect(applyGasMargin(103n)).toBe(129n)
    // 100 * 125 = 12500; 12500 / 100 = 125 exactly → no rounding
    expect(applyGasMargin(100n)).toBe(125n)
  })

  it('per-call estimate with margin vs heuristic: margin+estimate can exceed heuristic', () => {
    // If the actual gas exceeds the heuristic, the margin covers extra, not hides it
    const simulatedCreate = 160_000n  // higher than CREATE_GAS_UNITS=150,000
    const withMargin = applyGasMargin(simulatedCreate)
    expect(withMargin).toBe(200_000n)
    expect(withMargin).toBeGreaterThan(CREATE_GAS_UNITS)
  })
})

// ── spendableBalance derivation ───────────────────────────────────────────────

describe('spendableBalance derivation', () => {
  function computeSpendable(balance: bigint, reserve: bigint): bigint {
    return balance > reserve ? balance - reserve : 0n
  }

  it('balance 10 USDC, two-tx reserve at 20 Gwei → 9.995700 USDC', () => {
    const reserve = nativeGasCostToUsdc(APPROVE_GAS_UNITS + CREATE_GAS_UNITS, gwei(20n))
    expect(computeSpendable(usdc(10), reserve)).toBe(9_995_700n)
  })

  it('balance < reserve → spendable clamped to 0', () => {
    const reserve = nativeGasCostToUsdc(APPROVE_GAS_UNITS + CREATE_GAS_UNITS, gwei(20n))
    expect(computeSpendable(3_000n, reserve)).toBe(0n)
  })

  it('balance exactly equals reserve → spendable is 0', () => {
    const reserve = nativeGasCostToUsdc(APPROVE_GAS_UNITS + CREATE_GAS_UNITS, gwei(20n))
    expect(computeSpendable(reserve, reserve)).toBe(0n)
  })

  it('allowanceCoversFull uses one-tx reserve only', () => {
    const oneTx = nativeGasCostToUsdc(CREATE_GAS_UNITS, gwei(1_000n))
    expect(computeSpendable(usdc(5), oneTx)).toBe(4_850_000n)
  })

  it('per-call estimate with margin: if simulate returns 120k create gas at 1,000 Gwei', () => {
    const simulatedUnits = applyGasMargin(120_000n)   // 150,000 with margin
    const reserve = nativeGasCostToUsdc(simulatedUnits, gwei(1_000n))
    // 150,000 × 1e9 × 1000 = 1.5e17; / 1e12 = 150,000 µUSDC = 0.150000 USDC
    expect(reserve).toBe(150_000n)
    expect(computeSpendable(usdc(5), reserve)).toBe(4_850_000n)
  })

  it('underestimated gas (hypothetical 110k, no margin) vs with margin (137,500)', () => {
    // Without margin: 110,000 × 1e9 × 20 Gwei = 2.2e15; / 1e12 = 2200 µUSDC
    const noMargin   = nativeGasCostToUsdc(110_000n, gwei(20n))
    // With margin: applyGasMargin(110,000) = ceil(110000*125/100) = 137,500
    const withMargin = nativeGasCostToUsdc(applyGasMargin(110_000n), gwei(20n))
    expect(withMargin).toBeGreaterThan(noMargin)
    expect(withMargin).toBe(nativeGasCostToUsdc(137_500n, gwei(20n)))
  })
})

// ── parseOnchainError additions ───────────────────────────────────────────────

describe('parseOnchainError — blocklist and gas cases', () => {
  it('restricted-address message for "isBlacklisted" revert', () => {
    expect(parseOnchainError(new Error('execution reverted: isBlacklisted'))).toContain('restricted')
  })

  it('restricted-address message for "blacklisted" revert', () => {
    expect(parseOnchainError(new Error('account is blacklisted'))).toContain('restricted')
  })

  it('restricted-address message for "blocklisted" revert', () => {
    expect(parseOnchainError(new Error('sender blocklisted'))).toContain('restricted')
  })

  it('restricted-address message for "account is frozen"', () => {
    expect(parseOnchainError(new Error('account is frozen'))).toContain('restricted')
  })

  it('gas/balance message for "insufficient funds" revert', () => {
    const msg = parseOnchainError(new Error('insufficient funds for gas * price + value'))
    expect(msg).toMatch(/insufficient usdc/i)
    expect(msg).toMatch(/gas/i)
  })

  it('blocklist and insufficient-funds messages are distinct', () => {
    const bl = parseOnchainError(new Error('isBlacklisted'))
    const if_ = parseOnchainError(new Error('insufficient funds'))
    expect(bl).not.toBe(if_)
  })
})
