/**
 * Outcome and funds math — mirrors useFundsData logic exactly.
 * Reproduces fixture scenarios:
 *   #1: root with 2 children — delegated 1.50, settled 0.30, returned 1.20,
 *       held = budget − delegated + returned − outcomeAmount
 *   #2: child — returned 0.70, settled by children 0.30
 */
import { describe, it, expect } from 'vitest'
import { CommitmentState, FailReason } from '@/lib/types'
import type { Commitment } from '@/lib/types'

// ── Mirror the argBig helper ──────────────────────────────────────────────────
function argBig(a: Record<string, unknown>, k: string): bigint {
  const v = a[k]
  try {
    return BigInt(typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' ? String(v) : '0')
  } catch { return 0n }
}

type MockEvent = {
  eventName: string
  args: Record<string, unknown>
  blockNumber: bigint
  transactionHash: `0x${string}` | null
  logIndex: number
}

// ── Mirror the pure computation from useFundsData ────────────────────────────
function computeFunds(
  c: Commitment,
  eventsForId: MockEvent[],
  allEvents: MockEvent[],
) {
  const childCreated         = eventsForId.filter(e => e.eventName === 'ChildCreated' && argBig(e.args, 'parentId') === c.id)
  const childIds             = new Set(childCreated.map(e => argBig(e.args, 'id')))
  const approvedChildren     = allEvents.filter(e => e.eventName === 'CommitmentApproved' && childIds.has(argBig(e.args, 'id')))
  const returnedFromChildren = eventsForId.filter(e => e.eventName === 'FundsReturned' && argBig(e.args, 'parentId') === c.id)

  const delegated = childCreated.reduce((s, e) => s + argBig(e.args, 'budget'), 0n)
  const settled   = approvedChildren.reduce((s, e) => s + argBig(e.args, 'released'), 0n)
  const returned  = returnedFromChildren.reduce((s, e) => s + argBig(e.args, 'amount'), 0n)

  let outcomeLabel = '', outcomeAmount: bigint | null = null

  if (c.state === CommitmentState.Succeeded) {
    outcomeLabel = 'Released'
    const ev = eventsForId.find(e => e.eventName === 'CommitmentApproved' && argBig(e.args, 'id') === c.id)
    if (ev) outcomeAmount = argBig(ev.args, 'released')
  } else if (c.state === CommitmentState.Failed && c.parentId > 0n) {
    outcomeLabel = 'Returned'
    const ev = eventsForId.find(e => e.eventName === 'FundsReturned' && argBig(e.args, 'childId') === c.id)
    if (ev) outcomeAmount = argBig(ev.args, 'amount')
  } else if (c.state === CommitmentState.Failed) {
    outcomeLabel = 'Refunded'
    outcomeAmount = c.budget - delegated + returned
    if (outcomeAmount < 0n) outcomeAmount = 0n
  }

  const computedHeld = outcomeAmount !== null ? c.budget - delegated + returned - outcomeAmount : null

  return { delegated, settled, returned, outcomeLabel, outcomeAmount, computedHeld }
}

// ── USDC amounts (6 decimals) ─────────────────────────────────────────────────
const u = (n: number) => BigInt(Math.round(n * 1e6))

// ── FIXTURE #1: root objective, budget 2.00, delegated 1.50, settled 0.30, returned 1.20 ──
describe('Fixture #1 — root objective with children', () => {
  const root: Commitment = {
    id: 1n, parentId: 0n,
    manager: '0xAA', approver: '0xBB', client: '0xCC',
    budget: u(2.00), remaining: u(0.50),
    delegationLimit: u(1.50), allocated: u(1.50),
    deadline: 9999999999n, depth: 0, childCount: 2,
    state: CommitmentState.Active, failReason: FailReason.None,
    title: 'Root #1', deliveryRef: '',
  }

  const events: MockEvent[] = [
    // two children created under root
    { eventName: 'ChildCreated', args: { id: '2', parentId: '1', budget: String(u(0.80)) }, blockNumber: 1n, transactionHash: '0xabc1', logIndex: 0 },
    { eventName: 'ChildCreated', args: { id: '3', parentId: '1', budget: String(u(0.70)) }, blockNumber: 2n, transactionHash: '0xabc2', logIndex: 0 },
    // child #2 approved (settled 0.30)
    { eventName: 'CommitmentApproved', args: { id: '2', released: String(u(0.30)) }, blockNumber: 5n, transactionHash: '0xabc3', logIndex: 0 },
    // child #3 rejected → FundsReturned 0.70 to root, child #2 FundsReturned 0.50 to root
    { eventName: 'FundsReturned', args: { parentId: '1', childId: '3', amount: String(u(0.70)) }, blockNumber: 6n, transactionHash: '0xabc4', logIndex: 0 },
    { eventName: 'FundsReturned', args: { parentId: '1', childId: '2', amount: String(u(0.50)) }, blockNumber: 7n, transactionHash: '0xabc5', logIndex: 0 },
  ]

  const eventsForRoot = events // all events include the root's id or its children
  const allEvents = events

  it('delegated = 1.50 USDC', () => {
    const { delegated } = computeFunds(root, eventsForRoot, allEvents)
    expect(delegated).toBe(u(1.50))
  })

  it('settled = 0.30 USDC (child #2 approved released)', () => {
    const { settled } = computeFunds(root, eventsForRoot, allEvents)
    expect(settled).toBe(u(0.30))
  })

  it('returned = 1.20 USDC (0.70 + 0.50 returned from children)', () => {
    const { returned } = computeFunds(root, eventsForRoot, allEvents)
    expect(returned).toBe(u(1.20))
  })

  it('root is Active so no outcomeAmount', () => {
    const { outcomeAmount } = computeFunds(root, eventsForRoot, allEvents)
    expect(outcomeAmount).toBeNull()
  })
})

// ── FIXTURE #2: child that was returned 0.70, its own child settled 0.30 ──────
describe('Fixture #2 — child commitment', () => {
  const child: Commitment = {
    id: 2n, parentId: 1n,
    manager: '0xAA', approver: '0xBB', client: '0xCC',
    budget: u(0.80), remaining: 0n,
    delegationLimit: u(0.60), allocated: u(0.30),
    deadline: 9999999999n, depth: 1, childCount: 1,
    state: CommitmentState.Failed, failReason: FailReason.Rejected,
    title: 'Child #2', deliveryRef: '',
  }

  const events: MockEvent[] = [
    // child #2 created a sub-child #4 for 0.30
    { eventName: 'ChildCreated', args: { id: '4', parentId: '2', budget: String(u(0.30)) }, blockNumber: 2n, transactionHash: '0xbbb1', logIndex: 0 },
    // sub-child #4 was approved — settled 0.30 from child #2
    { eventName: 'CommitmentApproved', args: { id: '4', released: String(u(0.30)) }, blockNumber: 4n, transactionHash: '0xbbb2', logIndex: 0 },
    // child #2 itself was rejected → 0.70 returned to parent #1
    { eventName: 'FundsReturned', args: { parentId: '1', childId: '2', amount: String(u(0.70)) }, blockNumber: 5n, transactionHash: '0xbbb3', logIndex: 0 },
  ]

  // For child #2: eventsFor(2n) includes events where id=2, parentId=2, childId=2
  const eventsForChild = events.filter(e => {
    const a = e.args
    if (e.eventName === 'ChildCreated')       return argBig(a, 'parentId') === 2n || argBig(a, 'id') === 2n
    if (e.eventName === 'CommitmentApproved') return argBig(a, 'id') === 2n
    if (e.eventName === 'FundsReturned')      return argBig(a, 'childId') === 2n || argBig(a, 'parentId') === 2n
    return false
  })

  it('settled by own children = 0.30 (sub-child approved)', () => {
    const { settled } = computeFunds(child, eventsForChild, events)
    expect(settled).toBe(u(0.30))
  })

  it('returned = 0 (FundsReturned events from child to parent #1 have parentId=1, not 2)', () => {
    // FundsReturned from child #2 to #1 has parentId=1 — not "returned FROM children to child#2"
    const { returned } = computeFunds(child, eventsForChild, events)
    expect(returned).toBe(0n)
  })

  it('outcomeLabel = Returned (child failed with parentId > 0)', () => {
    const { outcomeLabel, outcomeAmount } = computeFunds(child, eventsForChild, events)
    expect(outcomeLabel).toBe('Returned')
    // FundsReturned where childId === 2 → amount 0.70
    expect(outcomeAmount).toBe(u(0.70))
  })
})

// ── Edge case: root failed → refund = budget − delegated + returned ───────────
describe('Root failed — refund calculation', () => {
  const root: Commitment = {
    id: 5n, parentId: 0n,
    manager: '0xAA', approver: '0xBB', client: '0xCC',
    budget: u(3.00), remaining: 0n,
    delegationLimit: u(2.00), allocated: u(1.00),
    deadline: 1n, depth: 0, childCount: 1,
    state: CommitmentState.Failed, failReason: FailReason.Cancelled,
    title: 'Root #5', deliveryRef: '',
  }
  const events: MockEvent[] = [
    { eventName: 'ChildCreated', args: { id: '6', parentId: '5', budget: String(u(1.00)) }, blockNumber: 1n, transactionHash: '0xccc1', logIndex: 0 },
    { eventName: 'FundsReturned', args: { parentId: '5', childId: '6', amount: String(u(0.80)) }, blockNumber: 2n, transactionHash: '0xccc2', logIndex: 0 },
  ]

  it('outcomeLabel = Refunded, outcomeAmount = budget(3) − delegated(1) + returned(0.80) = 2.80', () => {
    const { outcomeLabel, outcomeAmount } = computeFunds(root, events, events)
    expect(outcomeLabel).toBe('Refunded')
    expect(outcomeAmount).toBe(u(2.80))
  })
})
