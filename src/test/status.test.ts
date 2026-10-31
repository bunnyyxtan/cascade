/**
 * statusOf — all 6 statuses
 */
import { describe, it, expect } from 'vitest'
import { statusOf } from '@/lib/status'
import { CommitmentState, FailReason } from '@/lib/types'

describe('statusOf', () => {
  it('Active state → active', () => {
    const s = statusOf(CommitmentState.Active)
    expect(s.kind).toBe('active')
    expect(s.label).toBe('Active')
  })

  it('Submitted state → submitted', () => {
    const s = statusOf(CommitmentState.Submitted)
    expect(s.kind).toBe('submitted')
    expect(s.label).toBe('Submitted')
  })

  it('Succeeded state → settled', () => {
    const s = statusOf(CommitmentState.Succeeded)
    expect(s.kind).toBe('settled')
    expect(s.label).toBe('Settled')
  })

  it('Failed + Rejected → rejected', () => {
    const s = statusOf(CommitmentState.Failed, FailReason.Rejected)
    expect(s.kind).toBe('rejected')
    expect(s.label).toBe('Rejected')
  })

  it('Failed + Cancelled → cancelled', () => {
    const s = statusOf(CommitmentState.Failed, FailReason.Cancelled)
    expect(s.kind).toBe('cancelled')
    expect(s.label).toBe('Cancelled')
  })

  it('Failed + Expired → expired', () => {
    const s = statusOf(CommitmentState.Failed, FailReason.Expired)
    expect(s.kind).toBe('expired')
    expect(s.label).toBe('Expired')
  })

  it('Failed with no reason → cancelled (default fallback)', () => {
    const s = statusOf(CommitmentState.Failed, FailReason.None)
    expect(s.kind).toBe('cancelled')
  })

  it('every status has distinct bg, fg, dot', () => {
    const kinds = ['active', 'submitted', 'settled', 'rejected', 'cancelled', 'expired'] as const
    const seen = new Set<string>()
    for (const kind of kinds) {
      const s = statusOf(
        kind === 'active'    ? CommitmentState.Active :
        kind === 'submitted' ? CommitmentState.Submitted :
        kind === 'settled'   ? CommitmentState.Succeeded :
        CommitmentState.Failed,
        kind === 'rejected'  ? FailReason.Rejected :
        kind === 'cancelled' ? FailReason.Cancelled :
        kind === 'expired'   ? FailReason.Expired : undefined,
      )
      const sig = `${s.bg}|${s.fg}|${s.dot}`
      expect(seen.has(sig)).toBe(false)
      seen.add(sig)
    }
  })
})
