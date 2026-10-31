/**
 * Cascade toast helpers.
 * All toasts use sonner's API; styling is in index.css (.cascade-toast).
 * Fire only on confirmed real events — no speculative toasts before receipts.
 */
import { toast } from 'sonner'

export function toastConnected(address: string) {
  toast.success(`Wallet connected`, {
    description: address.slice(0, 6) + '…' + address.slice(-4),
  })
}

export function toastDisconnected() {
  toast(`Wallet disconnected`)
}

export function toastNetworkSwitched(chainName: string) {
  toast.success(`Switched to ${chainName}`)
}

export function toastCopied(label = 'Address copied') {
  toast.success(label)
}

export function toastCopyFailed() {
  toast.error('Copy failed', { description: 'Select the text and copy manually.' })
}
