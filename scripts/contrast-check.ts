/**
 * contrast-check.ts — WCAG contrast ratio checker for design tokens.
 *
 * Computes relative luminance and contrast ratio for every text token
 * on --paper (#F8F8F5) and --surface (#FFFFFF).
 * Exits with code 1 if any combination falls below 4.5:1 (WCAG AA normal text).
 *
 * Run: bun run scripts/contrast-check.ts
 */

// ── Colour helpers ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return [r, g, b]
}

function linearise(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b)
}

function contrast(fg: string, bg: string): number {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const lighter = Math.max(l1, l2)
  const darker  = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// ── Token pairs to check ──────────────────────────────────────────────────────

const BACKGROUNDS = {
  '--paper':   '#F8F8F5',
  '--surface': '#FFFFFF',
}

const TEXT_TOKENS: Record<string, string> = {
  '--ink':           '#151714',
  '--text-2':        '#4A5245',
  '--text-3':        '#5F675A',
  '--dark':          '#1B1F1A',
  // Status foregrounds
  '--status-active-fg':     '#151714',
  '--status-submitted-fg':  '#7A5A12',
  '--status-settled-fg':    '#1F6B43',
  '--status-rejected-fg':   '#A63D3A',
  '--status-cancelled-fg':  '#4A5245',
  '--status-expired-fg':    '#7A5534',
}

// ── Run checks ────────────────────────────────────────────────────────────────

const PASS = 4.5
let failed = 0

console.log('\nWCAG AA contrast check (minimum 4.5:1 for normal text)\n')
console.log(`${'Token'.padEnd(32)} ${'Background'.padEnd(12)} ${'Ratio'.padEnd(8)} ${'Pass?'}`)
console.log('─'.repeat(62))

for (const [bgName, bgHex] of Object.entries(BACKGROUNDS)) {
  for (const [tokenName, tokenHex] of Object.entries(TEXT_TOKENS)) {
    const ratio = contrast(tokenHex, bgHex)
    const pass  = ratio >= PASS
    if (!pass) failed++
    const mark  = pass ? '✓' : '✗ FAIL'
    console.log(
      `${tokenName.padEnd(32)} ${bgName.padEnd(12)} ${ratio.toFixed(2).padEnd(8)} ${mark}`,
    )
  }
  console.log('')
}

if (failed > 0) {
  console.error(`\n${failed} combination(s) failed WCAG AA (4.5:1). Fix the token values.\n`)
  process.exit(1)
} else {
  console.log(`All combinations pass WCAG AA (≥ ${PASS}:1).\n`)
}
