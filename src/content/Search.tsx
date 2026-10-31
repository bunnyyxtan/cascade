/**
 * Search — client-side full-text search over docs headings and paragraphs.
 * No external service. Opened with "/" or Ctrl/Cmd+K.
 * Search index built lazily from the docs registry.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import { contentNavigate } from '@/router'
import type { DocEntry } from './docsRegistry'

interface SearchResult {
  slug:    string
  title:   string
  excerpt: string
  score:   number
}

function buildIndex(docs: DocEntry[]): SearchResult[] {
  const results: SearchResult[] = []
  for (const doc of docs) {
    // Add title match
    results.push({ slug: doc.slug, title: doc.title, excerpt: doc.description, score: 0 })
    // Add heading matches
    for (const h of doc.headings) {
      results.push({ slug: `${doc.slug}#${h.id}`, title: h.text, excerpt: doc.title, score: 0 })
    }
  }
  return results
}

function search(index: SearchResult[], query: string): SearchResult[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return index
    .map(item => {
      const titleScore = item.title.toLowerCase().includes(q) ? 2 : 0
      const excerptScore = item.excerpt.toLowerCase().includes(q) ? 1 : 0
      return { ...item, score: titleScore + excerptScore }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
}

interface SearchDialogProps {
  docs: DocEntry[]
  onClose: () => void
}

function SearchDialog({ docs, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [rawSelected, setRawSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const index = buildIndex(docs)
  const results = search(index, query)
  // Clamp selected to valid range without needing an effect
  const selected = Math.min(rawSelected, Math.max(0, results.length - 1))

  useEffect(() => { inputRef.current?.focus() }, [])

  function navigate(slug: string) {
    const path = slug.includes('#')
      ? `/docs/${slug.split('#')[0]}#${slug.split('#')[1]}`
      : slug === 'index' ? '/docs' : `/docs/${slug}`
    contentNavigate(path)
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setRawSelected(s => Math.min(s + 1, results.length - 1)); return }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setRawSelected(s => Math.max(s - 1, 0)); return }
    if (e.key === 'Enter' && results[selected]) { navigate(results[selected].slug) }
  }

  return (
    <div className="search-overlay" role="dialog" aria-label="Search documentation" aria-modal="true">
      <div className="search-backdrop" onClick={onClose} />
      <div className="search-dialog" onKeyDown={handleKey}>
        <div className="search-input-row">
          <SearchIcon size={16} className="search-input-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            placeholder="Search docs…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search query"
            aria-autocomplete="list"
            aria-controls="search-results"
          />
          <button className="search-close-btn" onClick={onClose} aria-label="Close search">
            <X size={14} />
          </button>
        </div>

        {results.length > 0 && (
          <ul
            id="search-results"
            className="search-results"
            role="listbox"
            aria-label="Search results"
          >
            {results.map((r, i) => (
              <li
                key={r.slug}
                role="option"
                aria-selected={i === selected}
                className={`search-result${i === selected ? ' search-result--active' : ''}`}
                onClick={() => navigate(r.slug)}
                onMouseEnter={() => setRawSelected(i)}
              >
                <span className="search-result-title">{r.title}</span>
                <span className="search-result-excerpt">{r.excerpt}</span>
              </li>
            ))}
          </ul>
        )}

        {query.trim() && results.length === 0 && (
          <p className="search-empty">No results for "{query}"</p>
        )}

        <div className="search-footer" aria-hidden="true">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> open</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}

interface SearchButtonProps {
  docs: DocEntry[]
}

export function SearchButton({ docs }: SearchButtonProps) {
  const [open, setOpen] = useState(false)

  const handleGlobalKey = useCallback((e: KeyboardEvent) => {
    if ((e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) ||
        ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
      e.preventDefault()
      setOpen(true)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [handleGlobalKey])

  return (
    <>
      <button
        className="search-trigger"
        onClick={() => setOpen(true)}
        aria-label="Search documentation (press / or Ctrl+K)"
      >
        <SearchIcon size={14} aria-hidden="true" />
        <span>Search</span>
        <kbd className="search-trigger-kbd" aria-hidden="true">/</kbd>
      </button>
      {open && <SearchDialog docs={docs} onClose={() => setOpen(false)} />}
    </>
  )
}
