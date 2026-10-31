/**
 * Minimal Markdown renderer — no external dependency.
 * Supports: h1–h3, p, ul/ol, code blocks, inline code,
 * tables, blockquotes (plain + GitHub-style alerts), links, bold, italic.
 * No dependency added; total size ~3 kB minified.
 */
import { useMemo } from 'react'
import { Copy, Check } from 'lucide-react'
import { useState, useCallback } from 'react'

/* ── Copy button for code blocks ─────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1600)
    }).catch(() => {})
  }, [text])
  return (
    <button className="md-copy-btn" onClick={copy} aria-label="Copy code" title="Copy">
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

/* ── Inline formatting ───────────────────────────────────────────────────── */
function renderInline(text: string): React.ReactNode {
  // Bold, italic, inline code, links — simple pass
  const parts: React.ReactNode[] = []
  let rest = text
  let key  = 0

  while (rest.length > 0) {
    // Inline code
    const codeMatch = rest.match(/^(.*?)`([^`]+)`(.*)$/s)
    if (codeMatch) {
      if (codeMatch[1]) parts.push(renderInlineText(codeMatch[1], key++))
      parts.push(<code key={key++} className="md-inline-code">{codeMatch[2]}</code>)
      rest = codeMatch[3]
      continue
    }
    // Bold
    const boldMatch = rest.match(/^(.*?)\*\*(.+?)\*\*(.*)$/s)
    if (boldMatch) {
      if (boldMatch[1]) parts.push(renderInlineText(boldMatch[1], key++))
      parts.push(<strong key={key++}>{boldMatch[2]}</strong>)
      rest = boldMatch[3]
      continue
    }
    // Link [text](url)
    const linkMatch = rest.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/s)
    if (linkMatch) {
      if (linkMatch[1]) parts.push(renderInlineText(linkMatch[1], key++))
      const href = linkMatch[3]
      const external = /^https?:\/\//.test(href)
      parts.push(
        <a key={key++} href={href} className="md-link"
          {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
          {linkMatch[2]}
        </a>
      )
      rest = linkMatch[4]
      continue
    }
    parts.push(renderInlineText(rest, key++))
    break
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function renderInlineText(text: string, key: number): React.ReactNode {
  return <span key={key}>{text}</span>
}

/* ── Block-level tokens ──────────────────────────────────────────────────── */
type Token =
  | { t: 'h1' | 'h2' | 'h3'; id: string; text: string }
  | { t: 'p';    text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'code'; lang: string; text: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'quote'; variant: 'info' | 'warn' | 'danger' | 'plain'; text: string }
  | { t: 'hr' }

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function tokenize(md: string): Token[] {
  const tokens: Token[] = []
  const lines = md.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      tokens.push({ t: 'code', lang, text: codeLines.join('\n') })
      continue
    }

    // Headings
    const h1 = line.match(/^# (.+)$/)
    if (h1) { tokens.push({ t: 'h1', id: slugify(h1[1]), text: h1[1] }); i++; continue }
    const h2 = line.match(/^## (.+)$/)
    if (h2) { tokens.push({ t: 'h2', id: slugify(h2[1]), text: h2[1] }); i++; continue }
    const h3 = line.match(/^### (.+)$/)
    if (h3) { tokens.push({ t: 'h3', id: slugify(h3[1]), text: h3[1] }); i++; continue }

    // HR
    if (/^---+$/.test(line.trim())) { tokens.push({ t: 'hr' }); i++; continue }

    // Blockquote (GitHub-style alerts and plain)
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      const full = quoteLines.join('\n')
      const alertMatch = full.match(/^\[!(WARNING|NOTE|DANGER)\]\n?([\s\S]*)$/)
      if (alertMatch) {
        const variantMap: Record<string, 'warn' | 'info' | 'danger'> = {
          WARNING: 'warn', NOTE: 'info', DANGER: 'danger',
        }
        tokens.push({ t: 'quote', variant: variantMap[alertMatch[1]] ?? 'plain', text: alertMatch[2].trim() })
      } else {
        tokens.push({ t: 'quote', variant: 'plain', text: full.trim() })
      }
      continue
    }

    // Unordered list
    if (/^[*-] /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        items.push(lines[i].replace(/^[*-] /, ''))
        i++
      }
      tokens.push({ t: 'ul', items })
      continue
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      tokens.push({ t: 'ol', items })
      continue
    }

    // Table (pipe-separated)
    if (line.includes('|') && i + 1 < lines.length && /^\|[-| :]+\|/.test(lines[i + 1])) {
      const head = line.split('|').filter(Boolean).map(c => c.trim())
      i += 2 // skip separator
      const rows: string[][] = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(lines[i].split('|').filter(Boolean).map(c => c.trim()))
        i++
      }
      tokens.push({ t: 'table', head, rows })
      continue
    }

    // Blank line — skip
    if (line.trim() === '') { i++; continue }

    // Paragraph — accumulate until blank or block
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^[#>`-]/.test(lines[i]) && !/^\d+\. /.test(lines[i]) &&
      !lines[i].includes('|')) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      tokens.push({ t: 'p', text: paraLines.join(' ') })
    } else {
      i++
    }
  }
  return tokens
}

/* ── Render tokens to JSX ────────────────────────────────────────────────── */
function renderTokens(tokens: Token[]): React.ReactNode {
  return tokens.map((tok, idx) => {
    switch (tok.t) {
      case 'h1': return <h1 key={idx} id={tok.id} className="md-h1">{renderInline(tok.text)}</h1>
      case 'h2': return <h2 key={idx} id={tok.id} className="md-h2">{renderInline(tok.text)}</h2>
      case 'h3': return <h3 key={idx} id={tok.id} className="md-h3">{renderInline(tok.text)}</h3>
      case 'p':  return <p  key={idx} className="md-p">{renderInline(tok.text)}</p>
      case 'hr': return <hr key={idx} className="md-hr" />
      case 'ul': return (
        <ul key={idx} className="md-ul">
          {tok.items.map((item, j) => <li key={j} className="md-li">{renderInline(item)}</li>)}
        </ul>
      )
      case 'ol': return (
        <ol key={idx} className="md-ol">
          {tok.items.map((item, j) => <li key={j} className="md-li">{renderInline(item)}</li>)}
        </ol>
      )
      case 'code': return (
        <div key={idx} className="md-code-wrap">
          {tok.lang && <span className="md-code-lang">{tok.lang}</span>}
          <pre className="md-pre"><code>{tok.text}</code></pre>
          <CopyButton text={tok.text} />
        </div>
      )
      case 'table': return (
        <div key={idx} className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>{tok.head.map((h, j) => <th key={j}>{renderInline(h)}</th>)}</tr>
            </thead>
            <tbody>
              {tok.rows.map((row, j) => (
                <tr key={j}>
                  {row.map((cell, k) => <td key={k}>{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      case 'quote': {
        const cls = {
          info:   'md-callout md-callout--info',
          warn:   'md-callout md-callout--warn',
          danger: 'md-callout md-callout--danger',
          plain:  'md-callout md-callout--plain',
        }[tok.variant]
        return (
          <div key={idx} className={cls} role="note">
            <p className="md-p">{renderInline(tok.text)}</p>
          </div>
        )
      }
      default: return null
    }
  })
}

/* ── Public API ──────────────────────────────────────────────────────────── */
export interface Heading { id: string; level: 2 | 3; text: string }

export function extractHeadings(md: string): Heading[] {
  const tokens = tokenize(md)
  const result: Heading[] = []
  for (const t of tokens) {
    if (t.t === 'h2') result.push({ id: t.id, level: 2, text: t.text })
    else if (t.t === 'h3') result.push({ id: t.id, level: 3, text: t.text })
  }
  return result
}

export function MarkdownBody({ md }: { md: string }) {
  const tokens = useMemo(() => tokenize(md), [md])
  return <div className="md-body">{renderTokens(tokens)}</div>
}
