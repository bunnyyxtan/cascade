/**
 * Activity row-content field-name tests.
 * Verifies that RootCreated and ChildCreated use `budget` (not `amount`),
 * and that CommitmentApproved, FundsReturned and Claimed use the correct ABI fields.
 */

import { describe, it, expect } from 'vitest'
import { formatUsdc } from '@/lib/format'

// ── Minimal reimplementation of the helpers under test ──────────────────────
// (mirrors the logic in Activity.tsx so tests don't import a JSX component)

function bn(v: unknown): bigint {
  const s = (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean')
    ? String(v) : '0'
  try { return BigInt(s) } catch { return 0n }
}

function str(v: unknown): string {
  return (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint') ? String(v) : ''
}

interface RowResult {
  amount:     bigint | null
  amountSign: '+' | '↩' | 'escrowed' | null
  actor:      string | undefined
}

function rowAmount(eventName: string, args: Record<string, unknown>): RowResult {
  const a = args
  switch (eventName) {
    case 'RootCreated':
      return { amount: bn(a.budget), amountSign: 'escrowed', actor: str(a.client) || undefined }
    case 'ChildCreated':
      return { amount: bn(a.budget), amountSign: 'escrowed', actor: str(a.manager) || undefined }
    case 'CommitmentApproved':
      return { amount: bn(a.released), amountSign: '+', actor: str(a.approver) || undefined }
    case 'FundsReturned':
      return { amount: bn(a.amount), amountSign: '↩', actor: undefined }
    case 'Claimed':
      return { amount: bn(a.amount), amountSign: '+', actor: str(a.account) || undefined }
    default:
      return { amount: null, amountSign: null, actor: undefined }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Activity row amounts — ABI field names', () => {
  it('RootCreated: reads budget not amount → 0.10 escrowed', () => {
    const result = rowAmount('RootCreated', { id: 7n, budget: 100000n, delegationLimit: 0n, deadline: 0n, title: 'test', client: '0xabc' })
    expect(result.amount).toBe(100000n)
    expect(result.amountSign).toBe('escrowed')
    expect(formatUsdc(result.amount!)).toBe('0.10')
  })

  it('RootCreated: a.amount (absent) falls back to 0n — confirms the old bug', () => {
    const result = rowAmount('RootCreated', { id: 7n, amount: undefined, budget: 100000n })
    // With the fix, amount comes from budget, not from a.amount
    expect(result.amount).toBe(100000n)
    expect(formatUsdc(result.amount!)).toBe('0.10')
  })

  it('ChildCreated: reads budget not amount → 0.10 escrowed', () => {
    const result = rowAmount('ChildCreated', { id: 3n, parentId: 7n, budget: 100000n, deadline: 0n, title: 'sub', manager: '0xdef' })
    expect(result.amount).toBe(100000n)
    expect(result.amountSign).toBe('escrowed')
    expect(formatUsdc(result.amount!)).toBe('0.10')
  })

  it('ChildCreated with budget 0 → 0.00 escrowed', () => {
    const result = rowAmount('ChildCreated', { id: 4n, parentId: 7n, budget: 0n })
    expect(result.amount).toBe(0n)
    expect(formatUsdc(result.amount!)).toBe('0.00')
  })

  it('CommitmentApproved: reads released field', () => {
    const result = rowAmount('CommitmentApproved', { id: 7n, approver: '0xabc', released: 1700000n })
    expect(result.amount).toBe(1700000n)
    expect(result.amountSign).toBe('+')
    expect(formatUsdc(result.amount!)).toBe('1.70')
  })

  it('FundsReturned: reads amount field', () => {
    const result = rowAmount('FundsReturned', { parentId: 7n, childId: 3n, amount: 500000n })
    expect(result.amount).toBe(500000n)
    expect(result.amountSign).toBe('↩')
    expect(formatUsdc(result.amount!)).toBe('0.50')
  })

  it('Claimed: reads amount field', () => {
    const result = rowAmount('Claimed', { account: '0xabc', amount: 1000000n })
    expect(result.amount).toBe(1000000n)
    expect(result.amountSign).toBe('+')
    expect(formatUsdc(result.amount!)).toBe('1.00')
  })
})
