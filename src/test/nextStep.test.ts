/**
 * nextStep — manager, approver, client, stranger × active, submitted, finished
 */
import { describe, it, expect } from 'vitest'
import { nextStep } from '@/components/CommitmentWorkspace'
import { CommitmentState, FailReason } from '@/lib/types'
import type { Commitment } from '@/lib/types'

const MANAGER  = '0xAAAA000000000000000000000000000000000001'
const APPROVER = '0xBBBB000000000000000000000000000000000002'
const CLIENT   = '0xCCCC000000000000000000000000000000000003'
const STRANGER = '0xDDDD000000000000000000000000000000000004'

const FUTURE_DEADLINE = BigInt(Math.floor(Date.now() / 1000) + 86400 * 7) // 7 days out
const PAST_DEADLINE   = BigInt(Math.floor(Date.now() / 1000) - 86400 * 1) // 1 day ago

function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 1n,
    parentId: 0n,
    manager:  MANAGER,
    approver: APPROVER,
    client:   CLIENT,
    budget:           1_000_000n,
    remaining:        1_000_000n,
    delegationLimit:    500_000n,
    allocated:                0n,
    deadline:  FUTURE_DEADLINE,
    depth:     0,
    childCount: 0,
    state:     CommitmentState.Active,
    failReason: FailReason.None,
    title:     'Test commitment',
    deliveryRef: '',
    ...overrides,
  }
}

describe('nextStep — Active, no children, future deadline', () => {
  const c = makeCommitment()
  const noChildren: Commitment[] = []

  it('manager sees submit prompt', () => {
    const msg = nextStep(c, noChildren, MANAGER)
    expect(msg).toMatch(/ready to submit/i)
  })

  it('approver sees waiting-for-manager', () => {
    const msg = nextStep(c, noChildren, APPROVER)
    expect(msg).toMatch(/waiting for/i)
  })

  it('client sees waiting-for-manager', () => {
    const msg = nextStep(c, noChildren, CLIENT)
    expect(msg).toMatch(/waiting for/i)
  })

  it('stranger sees waiting-for-manager', () => {
    const msg = nextStep(c, noChildren, STRANGER)
    expect(msg).toMatch(/waiting for/i)
  })
})

describe('nextStep — Submitted', () => {
  const c = makeCommitment({ state: CommitmentState.Submitted })
  const noChildren: Commitment[] = []

  it('approver sees review prompt', () => {
    const msg = nextStep(c, noChildren, APPROVER)
    expect(msg).toMatch(/ready for your review/i)
  })

  it('manager sees waiting-for-approver', () => {
    const msg = nextStep(c, noChildren, MANAGER)
    expect(msg).toMatch(/waiting for/i)
  })

  it('stranger sees waiting-for-approver', () => {
    const msg = nextStep(c, noChildren, STRANGER)
    expect(msg).toMatch(/waiting for/i)
  })
})

describe('nextStep — Settled (Succeeded)', () => {
  const c = makeCommitment({ state: CommitmentState.Succeeded })
  const noChildren: Commitment[] = []

  it('returns settled message for manager', () => {
    const msg = nextStep(c, noChildren, MANAGER)
    expect(msg).toMatch(/settled/i)
  })

  it('returns settled message for stranger', () => {
    const msg = nextStep(c, noChildren, STRANGER)
    expect(msg).toMatch(/settled/i)
  })
})

describe('nextStep — Failed (Rejected)', () => {
  const c = makeCommitment({ state: CommitmentState.Failed, failReason: FailReason.Rejected })
  it('returns rejected message', () => {
    expect(nextStep(c, [], MANAGER)).toMatch(/rejected/i)
  })
})

describe('nextStep — Failed (Cancelled)', () => {
  const c = makeCommitment({ state: CommitmentState.Failed, failReason: FailReason.Cancelled })
  it('returns cancelled message', () => {
    expect(nextStep(c, [], STRANGER)).toMatch(/cancelled/i)
  })
})

describe('nextStep — Failed (Expired)', () => {
  const c = makeCommitment({ state: CommitmentState.Failed, failReason: FailReason.Expired })
  it('returns expired message', () => {
    expect(nextStep(c, [], MANAGER)).toMatch(/expired/i)
  })
})

describe('nextStep — Active with past deadline', () => {
  const c = makeCommitment({ deadline: PAST_DEADLINE })
  it('anyone can expire it', () => {
    const msg = nextStep(c, [], STRANGER)
    expect(msg).toMatch(/anyone can expire/i)
  })
})

describe('nextStep — Active with unresolved children', () => {
  const c = makeCommitment()
  const activeChild = makeCommitment({ id: 2n, state: CommitmentState.Active })
  it('shows wait-for-children message', () => {
    const msg = nextStep(c, [activeChild], MANAGER)
    expect(msg).toMatch(/waiting for all child/i)
  })
})
