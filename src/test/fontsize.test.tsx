/**
 * Font-size floor tests — every computed inline font-size must be ≥ 12px.
 *
 * jsdom does not evaluate CSS variables, so we read the inline `style`
 * attribute directly and convert to px:
 *   - numeric values (from Amount)  → already px
 *   - rem strings (from StatusBadge) → multiply by 16 (browser default root)
 *
 * These tests catch regressions that check:type cannot catch: sizes that are
 * computed at runtime (Math.max, conditional ternaries, proportional math).
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Amount, type AmountSize } from '@/components/ui/Amount'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { STATUS_MAP } from '@/lib/status'

const ROOT_PX = 16 // browser default; used to convert rem → px

/** Parse an inline font-size string → px number. */
function parsePx(raw: string): number {
  if (!raw) return NaN
  if (raw.endsWith('rem')) return parseFloat(raw) * ROOT_PX
  if (raw.endsWith('px'))  return parseFloat(raw)
  return parseFloat(raw) // numeric (jsdom stores bare numbers as strings too)
}

/** Collect all inline fontSize values from every element in a container. */
function allInlineFontSizes(container: HTMLElement): number[] {
  const sizes: number[] = []
  container.querySelectorAll('*').forEach(el => {
    const raw = (el as HTMLElement).style?.fontSize
    if (raw) {
      const px = parsePx(raw)
      if (!isNaN(px)) sizes.push(px)
    }
  })
  return sizes
}

// ── StatusBadge ────────────────────────────────────────────────────────────

describe('StatusBadge font-size floor', () => {
  const sizes = ['sm', 'md'] as const
  const sampleStatus = STATUS_MAP.active

  for (const size of sizes) {
    it(`size="${size}" → every inline font-size ≥ 12px`, () => {
      const { container } = render(<StatusBadge status={sampleStatus} size={size} />)
      const fss = allInlineFontSizes(container)
      expect(fss.length).toBeGreaterThan(0)
      for (const fs of fss) {
        expect(fs, `size=${size} produced ${fs}px`).toBeGreaterThanOrEqual(12)
      }
    })
  }
})

// ── Amount ─────────────────────────────────────────────────────────────────

describe('Amount font-size floor', () => {
  const sizes: AmountSize[] = ['sm', 'md', 'lg', 'xl']
  const signs = ['released', 'returned', 'refunded', 'held', 'none'] as const

  for (const size of sizes) {
    for (const sign of signs) {
      it(`size="${size}" sign="${sign}" → every inline font-size ≥ 12px`, () => {
        const { container } = render(<Amount value="1.00" size={size} sign={sign} />)
        const fss = allInlineFontSizes(container)
        // The main value span always has an inline fontSize, so list is non-empty
        expect(fss.length).toBeGreaterThan(0)
        for (const fs of fss) {
          expect(fs, `size=${size} sign=${sign} produced ${fs}px`).toBeGreaterThanOrEqual(12)
        }
      })
    }
  }
})
