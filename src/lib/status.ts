/**
 * status.ts — single source of truth for commitment status labels and colours.
 * statusOf() maps contract state + failReason to a display status.
 */
import { CommitmentState, FailReason } from './types'

export type StatusKind =
  | 'active'
  | 'submitted'
  | 'settled'
  | 'rejected'
  | 'cancelled'
  | 'expired'

export interface StatusStyle {
  kind:  StatusKind
  label: string
  bg:    string
  fg:    string
  dot:   string
}

const STATUS_MAP: Record<StatusKind, StatusStyle> = {
  active:    { kind: 'active',    label: 'Active',    bg: '#F3FBD9', fg: '#151714', dot: '#8DB82C' },
  submitted: { kind: 'submitted', label: 'Submitted', bg: '#FDF3DF', fg: '#7A5A12', dot: '#C49226' },
  settled:   { kind: 'settled',   label: 'Settled',   bg: '#E6F3EA', fg: '#1F6B43', dot: '#2E9A5E' },
  rejected:  { kind: 'rejected',  label: 'Rejected',  bg: '#FBE9E8', fg: '#A63D3A', dot: '#C75450' },
  cancelled: { kind: 'cancelled', label: 'Cancelled', bg: '#EEF0EC', fg: '#4A5245', dot: '#8A9285' },
  expired:   { kind: 'expired',   label: 'Expired',   bg: '#F4EDE4', fg: '#7A5534', dot: '#B07A4A' },
}

export function statusOf(
  state: CommitmentState,
  failReason?: FailReason,
): StatusStyle {
  switch (state) {
    case CommitmentState.Active:
      return STATUS_MAP.active
    case CommitmentState.Submitted:
      return STATUS_MAP.submitted
    case CommitmentState.Succeeded:
      return STATUS_MAP.settled
    case CommitmentState.Failed:
      switch (failReason) {
        case FailReason.Rejected:  return STATUS_MAP.rejected
        case FailReason.Cancelled: return STATUS_MAP.cancelled
        case FailReason.Expired:   return STATUS_MAP.expired
        default:                   return STATUS_MAP.cancelled
      }
    default:
      return STATUS_MAP.active
  }
}

export { STATUS_MAP }
