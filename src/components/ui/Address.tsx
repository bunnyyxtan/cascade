/**
 * Address — identicon + short mono address + "You" tag + copy + explorer link.
 * Identicon: deterministic 5×5 SVG pattern from the address bytes (no library).
 */
import { useState } from 'react'
import { Copy, ExternalLink } from 'lucide-react'
import { useAccount } from 'wagmi'
import { shortAddr } from '@/lib/format'
import { addrUrl } from '@/lib/contracts'

// ── Identicon ─────────────────────────────────────────────────────────────────

function djb2(s: string): number[] {
  const bytes: number[] = []
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i)
    bytes.push(h & 0xff)
  }
  return bytes
}

function Identicon({ address, size = 24 }: { address: string; size?: number }) {
  const addr = address.toLowerCase().replace('0x', '')
  const bytes = djb2(addr)
  const cells: boolean[] = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      const lit = (bytes[(row * 3 + col) % bytes.length] ?? 0) > 127
      cells.push(lit)
      if (col < 2) {
        if (col === 0) cells.splice(row * 5 + 4, 0, lit)
        else if (col === 1) cells.splice(row * 5 + 3, 0, lit)
      }
    }
  }
  const hue   = parseInt(addr.slice(0, 4), 16) % 360
  const color = `hsl(${hue},55%,48%)`
  const bg    = `hsl(${hue},30%,94%)`
  const cell  = size / 5

  return (
    <svg
      width={size} height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden
      style={{ borderRadius: size * 0.18, flexShrink: 0, background: bg }}
    >
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const idx = row * 5 + col
          if (!cells[idx]) return null
          return (
            <rect
              key={idx}
              x={col * cell + cell * 0.1} y={row * cell + cell * 0.1}
              width={cell * 0.8} height={cell * 0.8}
              fill={color} rx={cell * 0.15}
            />
          )
        })
      )}
    </svg>
  )
}

// ── Address component ─────────────────────────────────────────────────────────

interface AddressProps {
  address:    string
  identicon?: boolean
  copy?:      boolean
  explorer?:  boolean
  iconSize?:  number
}

export function AddressDisplay({
  address, identicon = true, copy = true, explorer = true, iconSize = 20,
}: AddressProps) {
  const [copied, setCopied] = useState(false)
  const { address: connected } = useAccount()
  const isYou = connected?.toLowerCase() === address.toLowerCase()

  function doCopy() {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <span className="addr-row">
      {identicon && <Identicon address={address} size={iconSize} />}
      <span className="addr-mono">{shortAddr(address)}</span>
      {isYou && <span className="addr-you-tag">You</span>}
      {copy && (
        <button
          onClick={doCopy}
          aria-label={copied ? 'Copied' : 'Copy address'}
          className="addr-copy-btn"
        >
          <Copy size={12} />
        </button>
      )}
      {explorer && (
        <a
          href={addrUrl(address)}
          target="_blank"
          rel="noreferrer"
          aria-label="View on explorer"
          className="addr-explorer-btn"
        >
          <ExternalLink size={12} />
        </a>
      )}
    </span>
  )
}
