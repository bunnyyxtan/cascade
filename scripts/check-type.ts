#!/usr/bin/env bun
/**
 * check-type.ts — typography lint.
 *
 * Rules enforced (all files under src/ except src/styles/tokens.css):
 *
 *  1. SUB12  — any CSS `font-size` value below 12px / 0.75rem.
 *              Allowed exceptions: clamp() values (display text), tokens.css.
 *
 *  2. INLINE — any `fontSize` key inside a JSX style={{ … }} block in *.tsx.
 *              Amount.tsx has a documented exception (proportional scaling);
 *              Landing.tsx has a documented exception (marketing page, original
 *              pre-D0a design preserved — sub-12px eyebrows intentional);
 *              all other app files must use CSS classes.
 *
 *  3. LITERAL — any CSS `font-size` that is a bare rem/px literal instead of
 *              var(--text-*) or var(--num-*).
 *              Allowed: tokens.css, clamp(), hero display classes (they may
 *              reference variables via the shorthand `font:` rather than
 *              font-size), and the legacy `.t-body*` / `.hero-*` classes which
 *              are wrappers over the token values.
 *
 * Exit 1 if any violation found.
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../src')
const TOKENS_FILE = resolve(SRC, 'styles/tokens.css')
// Amount.tsx uses proportional pixel math — documented exception for rule 2 (inline fontSize)
// but NOT for rule 1 (no sub-12px) or rule 3 (no literals in CSS).
const AMOUNT_FILE = resolve(SRC, 'components/ui/Amount.tsx')
// CascadeLogo.tsx uses proportional pixel math for the responsive wordmark (Math.max(12, …))
// — documented exception for rule 2 (inline fontSize), same rationale as Amount.tsx.
const LOGO_FILE = resolve(SRC, 'components/CascadeLogo.tsx')
// Layout.tsx LogoMark wordmark uses Math.max(12, …) proportional px — same exception.
const LAYOUT_FILE = resolve(SRC, 'components/Layout.tsx')
// Landing.tsx is the marketing page — original pre-D0a design preserved intentionally.
// It uses sub-12px mono eyebrows (0.6875rem), bare pixel sizes, and inline fontSize throughout.
// All three rules are skipped for this file.
const LANDING_FILE = resolve(SRC, 'components/Landing.tsx')

interface Violation {
  rule:    'SUB12' | 'INLINE' | 'LITERAL'
  file:    string
  line:    number
  content: string
}

const violations: Violation[] = []

// ── Helpers ──────────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/** Parse a CSS font-size value to px. Returns null when it can't be determined (var(), calc(), clamp()). */
function toPx(val: string): number | null {
  const v = val.trim()
  if (v.startsWith('var(') || v.startsWith('clamp(') || v.startsWith('calc(')) return null
  const remMatch = v.match(/^([0-9.]+)rem$/)
  if (remMatch) return parseFloat(remMatch[1]) * 16
  const pxMatch = v.match(/^([0-9.]+)px$/)
  if (pxMatch) return parseFloat(pxMatch[1])
  const emMatch = v.match(/^([0-9.]+)em$/)
  if (emMatch) return parseFloat(emMatch[1]) * 16 // treat as root-relative
  return null
}

/** True when the value is a bare size literal (not a token var, not clamp). */
function isLiteral(val: string): boolean {
  const v = val.trim()
  // Allow CSS keywords
  if (v === 'inherit' || v === 'initial' || v === 'unset' || v === 'revert') return false
  // Allow var(--text-*), var(--num-*), var(--fs-*), clamp(), calc()
  if (v.startsWith('var(--text-') || v.startsWith('var(--num-') || v.startsWith('var(--fs-')) return false
  if (v.startsWith('clamp(') || v.startsWith('calc(')) return false
  if (v.startsWith('var(')) return true // some other var — flag it
  return true
}

// ── CSS files ─────────────────────────────────────────────────────────────────

const cssFiles = walk(SRC).filter(f => f.endsWith('.css'))

for (const file of cssFiles) {
  const isTokens = resolve(file) === TOKENS_FILE
  const rel = relative(SRC, file)
  const lines = readFileSync(file, 'utf8').split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match   font-size: <value>;
    const m = line.match(/font-size\s*:\s*([^;{}]+)/i)
    if (!m) continue
    const val = m[1].trim()

    // Skip lines annotated as landing-original (marketing page CSS, original design preserved)
    if (line.includes('/* landing-ok */') || line.includes('/* pre-D0a:')) continue

    // Rule 1 — SUB12 (skip tokens.css, skip clamp)
    if (!isTokens) {
      const px = toPx(val)
      if (px !== null && px < 12) {
        violations.push({ rule: 'SUB12', file: rel, line: i + 1, content: line.trim() })
      }
    }

    // Rule 3 — LITERAL (skip tokens.css)
    if (!isTokens && isLiteral(val)) {
      violations.push({ rule: 'LITERAL', file: rel, line: i + 1, content: line.trim() })
    }
  }
}

// ── TSX files (rule 2 — inline fontSize) ─────────────────────────────────────
// We flag `fontSize:` that appears inside a JSX `style={{ }}` attribute.
// Strategy: track whether we are currently inside a `style={{` block by counting
// open/close braces after a `style={{` marker. We also flag the opening line itself
// when it contains `style={{` and `fontSize`.

const tsxFiles = walk(SRC).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'))
// main.tsx contains the Arc Studio watermark (framework, not app code) — skip rule 2
const MAIN_FILE = resolve(SRC, 'main.tsx')

for (const file of tsxFiles) {
  // Amount.tsx: documented exception (proportional px math) — skip rule 2
  if (resolve(file) === AMOUNT_FILE) continue
  // CascadeLogo.tsx: responsive wordmark uses proportional px math — skip rule 2
  if (resolve(file) === LOGO_FILE) continue
  // Layout.tsx: LogoMark withText wordmark uses proportional px math — skip rule 2
  if (resolve(file) === LAYOUT_FILE) continue
  // main.tsx: Arc Studio watermark (framework file) — skip rule 2
  if (resolve(file) === MAIN_FILE) continue
  // Landing.tsx: marketing page, original pre-D0a design preserved — skip all rules
  if (resolve(file) === LANDING_FILE) continue

  const rel = relative(SRC, file)
  const src  = readFileSync(file, 'utf8')
  const lines = src.split('\n')

  // Simple heuristic: flag lines where `fontSize:` appears AND the line is inside
  // a JSX expression (not a TS type/interface/const declaration context).
  // Signs that a line is a TS type context (not JSX style):
  //   - line starts with `const ` / `let ` / `type ` / `interface `
  //   - previous non-empty line ends with `=` or is a type annotation
  //   - the line only appears inside an object literal assigned to a typed const (no JSX context nearby)
  //
  // Simple heuristic we use:
  //   Flag the line if `fontSize:` is present AND it is not inside a plain TS const/object
  //   at the top of the file. We detect JSX context by looking for `style={{` either:
  //     a) on the same line, or
  //     b) in the preceding N lines (we track style block depth).

  let styleDepth = 0   // >0 when inside a style={{ ... }} block
  let inStyleBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect opening of a style={{ block
    const styleOpen = line.includes('style={{')
    if (styleOpen) {
      inStyleBlock = true
      styleDepth = 0
    }

    if (inStyleBlock) {
      // Count braces (approximate — good enough for well-formatted TSX)
      for (const ch of line) {
        if (ch === '{') styleDepth++
        if (ch === '}') styleDepth--
      }
      // Closed when depth hits ≤0 after the opening
      if (styleDepth <= 0 && !styleOpen) {
        inStyleBlock = false
      }
    }

    // Flag fontSize on this line only when we are inside (or on the opening of) a style block
    if (/fontSize\s*:/.test(line) && (inStyleBlock || styleOpen)) {
      // Skip lines in TS-only contexts (NOT JSX): const declarations, type aliases, interfaces
      const trimmed = line.trim()
      const isTsDecl = /^(const|let|var|type|interface)\s/.test(trimmed)
      if (!isTsDecl) {
        violations.push({ rule: 'INLINE', file: rel, line: i + 1, content: trimmed })
      }
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (violations.length === 0) {
  console.log('check-type: ✓  0 violations')
  process.exit(0)
}

const byRule: Record<string, Violation[]> = {}
for (const v of violations) {
  ;(byRule[v.rule] ??= []).push(v)
}

console.error(`check-type: ${violations.length} violation(s) found\n`)

for (const [rule, vs] of Object.entries(byRule)) {
  const desc =
    rule === 'SUB12'   ? 'font-size below 12px/0.75rem' :
    rule === 'INLINE'  ? 'inline fontSize in style={{ }}' :
                         'bare font-size literal (use var(--text-*) or var(--num-*))'
  console.error(`── ${rule}: ${desc} ──`)
  for (const v of vs) {
    console.error(`  ${v.file}:${v.line}   ${v.content}`)
  }
  console.error('')
}

process.exit(1)
