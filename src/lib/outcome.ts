/**
 * outcome.ts — pure function for computing a commitment's one-line outcome
 * from a set of history events.
 *
 * Shared by:
 *   - CommitmentWorkspace (tree node rows, via useNodeOutcome hook wrapper)
 *   - Explore (list row OutcomeLine)
 *
 * The function is pure: it takes a commitment and a flat array of HistoryEvents
 * scoped to that commitment's id, plus any globally-scoped FundsReturned events
 * needed for child-return lookups (already included by callers).
 */
import { CommitmentState, isTerminal } from './types'
import type { Commitment } from './types'
import { formatUsdc } from './format'
import type { HistoryEvent } from './history'

// ── Local argBig (mirrors CommitmentWorkspace / funds.test.ts) ─────────────

export function argBig(a: Record<string, unknown>, k: string): bigint {
  const v = a[k]
  try {
    return BigInt(
      typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' ? String(v) : '0',
    )
  } catch { return 0n }
}

// ── Result type ─────────────────────────────────────────────────────────────

export interface OutcomeResult {
  /** Short display text, e.g. "+1.70 released" or "↩ 0.20 to #2" */
  line: string
  /** Visual category for colouring */
  kind: 'settled' | 'returned' | 'held' | 'pending'
}

// ── computeOutcome — pure, no React ────────────────────────────────────────

/**
 * Compute a commitment's one-line outcome from events.
 *
 * @param c         The commitment (needs id, state, budget, parentId, depth)
 * @param events    ALL HistoryEvents from the store (not pre-filtered to this id).
 *                  The function filters internally so callers pass the full array.
 * @returns         OutcomeResult, or null when the commitment is not terminal and
 *                  we only want to show active/held state.
 *
 * Contract invariants used:
 *   - Succeeded → CommitmentApproved event exists for this id, `released` field
 *   - Failed child → FundsReturned event exists with `childId` === this id
 *   - Failed root → no FundsReturned with childId === this id; amount computed
 *     from budget − delegated + returned-from-children
 */
export function computeOutcome(c: Commitment, events: HistoryEvent[]): OutcomeResult {
  const myId = c.id

  // events concerning this commitment directly
  const myEvents = events.filter(e => {
    switch (e.eventName) {
      case 'CommitmentApproved':
        return argBig(e.args, 'id') === myId
      case 'FundsReturned':
        // includes both "I returned to parent" (childId===myId) and
        // "child returned to me" (parentId===myId)
        return argBig(e.args, 'childId') === myId || argBig(e.args, 'parentId') === myId
      case 'ChildCreated':
        return argBig(e.args, 'parentId') === myId
      case 'CommitmentRejected':
      case 'CommitmentCancelled':
      case 'CommitmentExpired':
        return argBig(e.args, 'id') === myId
      default:
        return false
    }
  })

  if (c.state === CommitmentState.Succeeded) {
    const ev = myEvents.find(e => e.eventName === 'CommitmentApproved')
    const released = ev ? argBig(ev.args, 'released') : null
    return {
      line: released !== null ? `+${formatUsdc(released)} released` : 'Settled',
      kind: 'settled',
    }
  }

  if (isTerminal(c.state)) {
    if (c.parentId > 0n) {
      // child failure — look for FundsReturned with childId === myId
      const fr = myEvents.find(
        e => e.eventName === 'FundsReturned' && argBig(e.args, 'childId') === myId,
      )
      if (fr) {
        const amt = argBig(fr.args, 'amount')
        const pid = argBig(fr.args, 'parentId')
        return { line: `↩ ${formatUsdc(amt)} to #${pid.toString()}`, kind: 'returned' }
      }
      return { line: 'Returned', kind: 'returned' }
    }
    // Root failure — refunded amount = budget − delegated + returned-from-children
    const delegated = myEvents
      .filter(e => e.eventName === 'ChildCreated')
      .reduce((s, e) => s + argBig(e.args, 'budget'), 0n)
    const returnedFromChildren = myEvents
      .filter(e => e.eventName === 'FundsReturned' && argBig(e.args, 'parentId') === myId)
      .reduce((s, e) => s + argBig(e.args, 'amount'), 0n)
    const r = c.budget - delegated + returnedFromChildren
    return {
      line: r > 0n ? `↩ ${formatUsdc(r)} refunded` : 'Refunded',
      kind: 'returned',
    }
  }

  // Active / submitted
  return { line: `${formatUsdc(c.remaining)} held`, kind: 'held' }
}
