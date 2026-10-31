/**
 * outcome.test.ts — computeOutcome against real testnet commitment fixtures.
 *
 * Fixtures match onchain state at Arc Testnet block ~69,056,151+.
 * USDC amounts are in 6-decimal units (1 USDC = 1_000_000n).
 *
 * The bug this test guards against:
 *   OutcomeLine previously used c.remaining (always 0 once terminal).
 *   computeOutcome reads event amounts instead.
 *
 * Expected results:
 *   #7  Succeeded  → +0.10 released       (CommitmentApproved released=100_000n)
 *   #1  Succeeded  → +1.70 released       (CommitmentApproved released=1_700_000n)
 *   #3  Succeeded  → +0.30 released       (CommitmentApproved released=300_000n)
 *   #6  Failed/root → ↩ 0.50 refunded    (budget=500_000, no children, no FundsReturned from children)
 *   #4  Failed/child → ↩ 0.20 to #2      (FundsReturned childId=4 amount=200_000 parentId=2)
 *   #5  Failed/child → ↩ 0.50 to #1      (FundsReturned childId=5 amount=500_000 parentId=1)
 *   #2  Failed/child → ↩ 0.70 to #1      (FundsReturned childId=2 amount=700_000 parentId=1)
 */
import { describe, it, expect } from 'vitest'
import { computeOutcome } from '@/lib/outcome'
import { CommitmentState, FailReason } from '@/lib/types'
import type { Commitment } from '@/lib/types'
import type { HistoryEvent } from '@/lib/history'

// ── Helpers ──────────────────────────────────────────────────────────────────

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const

function mkCommitment(overrides: Partial<Commitment> & { id: bigint }): Commitment {
  return {
    id:              overrides.id,
    parentId:        overrides.parentId        ?? 0n,
    depth:           overrides.depth           ?? 0,
    title:           overrides.title           ?? '',
    client:          overrides.client          ?? ZERO_ADDR,
    manager:         overrides.manager         ?? ZERO_ADDR,
    approver:        overrides.approver        ?? ZERO_ADDR,
    budget:          overrides.budget          ?? 0n,
    delegationLimit: overrides.delegationLimit ?? 0n,
    remaining:       overrides.remaining       ?? 0n,  // always 0 once terminal — the old bug
    deadline:        overrides.deadline        ?? 0n,
    childCount:      overrides.childCount      ?? 0,
    state:           overrides.state           ?? CommitmentState.Active,
    failReason:      overrides.failReason      ?? FailReason.None,
    deliveryRef:     overrides.deliveryRef     ?? '',
    allocated:       overrides.allocated       ?? 0n,
  }
}

function mkEvent(
  eventName: string,
  args: Record<string, string | number | bigint | null>,
  txHash: `0x${string}` = '0xdeadbeef00000000000000000000000000000000000000000000000000000000',
): HistoryEvent {
  return {
    eventName,
    args,
    blockNumber: 69_056_200n,
    transactionHash: txHash,
    logIndex: 0,
  }
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

// #7 — root, Succeeded, released 0.10 USDC
const c7 = mkCommitment({
  id:        7n,
  depth:     0,
  budget:    1_000_000n,
  remaining: 0n,   // zero once terminal — the old bug used this
  state:     CommitmentState.Succeeded,
})

// #1 — root, Succeeded, released 1.70 USDC (had two children: #2 and #5)
const c1 = mkCommitment({
  id:        1n,
  depth:     0,
  budget:    3_000_000n,
  remaining: 0n,
  state:     CommitmentState.Succeeded,
})

// #3 — root, Succeeded, released 0.30 USDC
const c3 = mkCommitment({
  id:        3n,
  depth:     0,
  budget:    1_000_000n,
  remaining: 0n,
  state:     CommitmentState.Succeeded,
})

// #6 — root, Failed (rejected), refunded 0.50 USDC, no children
const c6 = mkCommitment({
  id:         6n,
  depth:      0,
  budget:     500_000n,
  remaining:  0n,
  state:      CommitmentState.Failed,
  failReason: FailReason.Rejected,
})

// #4 — child of #2, Failed, returned 0.20 USDC to #2
const c4 = mkCommitment({
  id:         4n,
  parentId:   2n,
  depth:      2,
  budget:     200_000n,
  remaining:  0n,
  state:      CommitmentState.Failed,
  failReason: FailReason.Rejected,
})

// #5 — child of #1, Failed, returned 0.50 USDC to #1
const c5 = mkCommitment({
  id:         5n,
  parentId:   1n,
  depth:      1,
  budget:     500_000n,
  remaining:  0n,
  state:      CommitmentState.Failed,
  failReason: FailReason.Cancelled,
})

// #2 — child of #1, Failed, returned 0.70 USDC to #1 (had child #4)
const c2 = mkCommitment({
  id:         2n,
  parentId:   1n,
  depth:      1,
  budget:     1_200_000n,
  remaining:  0n,
  state:      CommitmentState.Failed,
  failReason: FailReason.Rejected,
})

// ── Events ───────────────────────────────────────────────────────────────────

// CommitmentApproved events
const ev_approved_7  = mkEvent('CommitmentApproved',  { id: '7',  released: '100000',   manager: ZERO_ADDR })
const ev_approved_1  = mkEvent('CommitmentApproved',  { id: '1',  released: '1700000',  manager: ZERO_ADDR })
const ev_approved_3  = mkEvent('CommitmentApproved',  { id: '3',  released: '300000',   manager: ZERO_ADDR })

// FundsReturned: #4 → #2
const ev_returned_4  = mkEvent('FundsReturned', { childId: '4', parentId: '2', amount: '200000' })
// FundsReturned: #5 → #1
const ev_returned_5  = mkEvent('FundsReturned', { childId: '5', parentId: '1', amount: '500000' })
// FundsReturned: #2 → #1
const ev_returned_2  = mkEvent('FundsReturned', { childId: '2', parentId: '1', amount: '700000' })

// ChildCreated: #1 created #2 (budget 1_200_000) and #5 (budget 500_000)
const ev_childCreated_2 = mkEvent('ChildCreated', { parentId: '1', id: '2', budget: '1200000' })
const ev_childCreated_5 = mkEvent('ChildCreated', { parentId: '1', id: '5', budget: '500000' })
// ChildCreated: #2 created #4 (budget 200_000)
const ev_childCreated_4 = mkEvent('ChildCreated', { parentId: '2', id: '4', budget: '200000' })

// CommitmentRejected for #6 (no children, budget 500_000 fully refunded)
const ev_rejected_6  = mkEvent('CommitmentRejected', { id: '6' })

// All events in the store (flat array, as history.ts provides)
const ALL_EVENTS: HistoryEvent[] = [
  ev_approved_7,
  ev_approved_1,
  ev_approved_3,
  ev_returned_4,
  ev_returned_5,
  ev_returned_2,
  ev_childCreated_2,
  ev_childCreated_5,
  ev_childCreated_4,
  ev_rejected_6,
]

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('computeOutcome — testnet fixtures', () => {
  it('#7 Succeeded → +0.10 released', () => {
    const result = computeOutcome(c7, ALL_EVENTS)
    expect(result.kind).toBe('settled')
    expect(result.line).toBe('+0.10 released')
  })

  it('#1 Succeeded → +1.70 released', () => {
    const result = computeOutcome(c1, ALL_EVENTS)
    expect(result.kind).toBe('settled')
    expect(result.line).toBe('+1.70 released')
  })

  it('#3 Succeeded → +0.30 released', () => {
    const result = computeOutcome(c3, ALL_EVENTS)
    expect(result.kind).toBe('settled')
    expect(result.line).toBe('+0.30 released')
  })

  it('#6 Failed root → ↩ 0.50 refunded', () => {
    const result = computeOutcome(c6, ALL_EVENTS)
    expect(result.kind).toBe('returned')
    expect(result.line).toBe('↩ 0.50 refunded')
  })

  it('#4 Failed child → ↩ 0.20 to #2', () => {
    const result = computeOutcome(c4, ALL_EVENTS)
    expect(result.kind).toBe('returned')
    expect(result.line).toBe('↩ 0.20 to #2')
  })

  it('#5 Failed child → ↩ 0.50 to #1', () => {
    const result = computeOutcome(c5, ALL_EVENTS)
    expect(result.kind).toBe('returned')
    expect(result.line).toBe('↩ 0.50 to #1')
  })

  it('#2 Failed child → ↩ 0.70 to #1', () => {
    const result = computeOutcome(c2, ALL_EVENTS)
    expect(result.kind).toBe('returned')
    expect(result.line).toBe('↩ 0.70 to #1')
  })

  it('active commitment shows held amount (not outcome)', () => {
    const c = mkCommitment({ id: 99n, budget: 2_000_000n, remaining: 2_000_000n, state: CommitmentState.Active })
    const result = computeOutcome(c, [])
    expect(result.kind).toBe('held')
    expect(result.line).toContain('held')
  })
})
