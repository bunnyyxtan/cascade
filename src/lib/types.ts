/** Mirrors the Cascade.Commitment struct from the contract. */
export interface Commitment {
  id: bigint
  parentId: bigint
  manager: `0x${string}`
  approver: `0x${string}`
  client: `0x${string}`
  budget: bigint
  remaining: bigint
  delegationLimit: bigint
  allocated: bigint
  deadline: bigint
  depth: number
  childCount: number
  state: CommitmentState
  failReason: FailReason
  title: string
  deliveryRef: string
}

export enum CommitmentState {
  Active = 0,
  Submitted = 1,
  Succeeded = 2,
  Failed = 3,
}

export enum FailReason {
  None = 0,
  Rejected = 1,
  Cancelled = 2,
  Expired = 3,
}

export function isTerminal(state: CommitmentState): boolean {
  return state === CommitmentState.Succeeded || state === CommitmentState.Failed
}

export function stateName(state: CommitmentState): string {
  return ['Active', 'Submitted', 'Succeeded', 'Failed'][state] ?? 'Unknown'
}

export function failReasonName(r: FailReason): string {
  return ['', 'Rejected', 'Cancelled', 'Expired'][r] ?? ''
}

/** Root-level delegation accounting derived from a root commitment. */
export interface DelegationMeter {
  budget: bigint
  delegationLimit: bigint
  reserve: bigint         // budget - delegationLimit
  allocated: bigint       // live + settled exposure
  available: bigint       // delegationLimit - allocated (capped at 0)
  settled: bigint         // permanently consumed (budget - delegationLimit - reserve + allocated - returned)
}

export function computeDelegation(c: Commitment): DelegationMeter {
  const reserve = c.budget - c.delegationLimit
  const available = c.allocated <= c.delegationLimit ? c.delegationLimit - c.allocated : 0n
  return {
    budget: c.budget,
    delegationLimit: c.delegationLimit,
    reserve,
    allocated: c.allocated,
    available,
    settled: c.allocated > 0n ? c.allocated : 0n,
  }
}
