/**
 * Formatting utilities for the Cascade UI.
 * All USDC amounts are 6-decimal ERC-20 values.
 */
import { USDC_DECIMALS } from './contracts'

/** Format a raw 6-decimal bigint to a human-readable USD string, e.g. "1,234.56" */
export function formatUsdc(raw: bigint | undefined, opts?: { digits?: number }): string {
  if (raw === undefined) return '—'
  const digits = opts?.digits ?? 2
  const num = Number(raw) / 10 ** USDC_DECIMALS
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num)
}

/** Parse a human-readable USDC string to a raw bigint. Returns undefined on invalid input. */
export function parseUsdc(input: string): bigint | undefined {
  const clean = input.replace(/[,$\s]/g, '')
  if (!/^\d*\.?\d*$/.test(clean) || clean === '' || clean === '.') return undefined
  const num = parseFloat(clean)
  if (isNaN(num) || num < 0) return undefined
  // Use string math to avoid float imprecision
  const [whole, frac = ''] = clean.split('.')
  const fracPadded = (frac + '000000').slice(0, USDC_DECIMALS)
  return BigInt(whole) * BigInt(10 ** USDC_DECIMALS) + BigInt(fracPadded)
}

/** Shorten an Ethereum address for display: 0x1234...abcd */
export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

/** Format a unix timestamp (seconds or ms) as a human-readable date */
export function formatDeadline(ts: bigint | number): string {
  const ms = typeof ts === 'bigint' ? Number(ts) * 1000 : ts > 1e12 ? ts : ts * 1000
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(ms))
}

/** Returns true when the deadline has already passed */
export function isPast(ts: bigint | number): boolean {
  const ms = typeof ts === 'bigint' ? Number(ts) * 1000 : ts > 1e12 ? ts : ts * 1000
  return Date.now() > ms
}

/** ms remaining until deadline — negative if past */
export function msUntil(ts: bigint | number): number {
  const ms = typeof ts === 'bigint' ? Number(ts) * 1000 : ts > 1e12 ? ts : ts * 1000
  return ms - Date.now()
}

/** Relative time label: "in 6 days" / "in 5 hours" / "Expired 2 days ago" */
export function relativeDeadline(ts: bigint | number): string {
  const remaining = msUntil(ts)
  if (remaining <= 0) {
    const ago = Math.abs(remaining)
    const days = Math.floor(ago / 86400000)
    if (days > 0) return `Expired ${days} ${days === 1 ? 'day' : 'days'} ago`
    const hours = Math.floor(ago / 3600000)
    if (hours > 0) return `Expired ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
    return 'Expired just now'
  }
  const days = Math.floor(remaining / 86400000)
  if (days > 0) return `in ${days} ${days === 1 ? 'day' : 'days'}`
  const hours = Math.floor(remaining / 3600000)
  if (hours > 0) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  const mins = Math.floor(remaining / 60000)
  return `in ${mins} ${mins === 1 ? 'minute' : 'minutes'}`
}

/** Parse an onchain error into a user-readable message */
export function parseOnchainError(err: unknown): string {
  const msg = (err as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance')) return 'Insufficient USDC for this transaction. Check your balance and gas costs.'
  if (msg.includes('isblacklisted') || msg.includes('blacklisted') || msg.includes('blocklisted') || msg.includes('account is frozen')) return 'This address is restricted from USDC transfers.'
  if (msg.includes('delegationcapacityexceeded')) return 'Delegation limit reached.'
  if (msg.includes('reservedbudgetviolation')) return 'Would violate protected reserve.'
  if (msg.includes('deadlinepassed')) return 'Commitment deadline has passed.'
  if (msg.includes('deadlinenotexpired')) return 'Deadline has not expired yet.'
  if (msg.includes('notmanager')) return 'Only the manager can perform this action.'
  if (msg.includes('notapprover')) return 'Only the approver can perform this action.'
  if (msg.includes('notactive')) return 'Commitment is not active.'
  if (msg.includes('notsubmitted')) return 'Commitment has not been submitted.'
  if (msg.includes('childrennotterminal')) return 'All children must be resolved first.'
  if (msg.includes('alreadyterminal')) return 'Commitment is already resolved.'
  if (msg.includes('nothingtoclaim')) return 'No USDC available to claim.'
  if (msg.includes('reverted')) {
    const match = msg.match(/reason[^:]*:\s*(.+)/)
    return match ? `Transaction failed: ${match[1]}` : 'Transaction failed. Please try again.'
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Please retry.'
  return 'Something went wrong. Please try again.'
}
