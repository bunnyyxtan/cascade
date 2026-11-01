/**
 * DocsSlugPage — renders a docs article by slug.
 * Markdown content is loaded from DOCS_CONTENT (docsContent.ts),
 * which ?raw-imports the .md files from docs/guide/ and docs/.
 */
import { useMemo } from 'react'
import { PageHead } from '../PageHead'
import { DocsLayout } from '../DocsLayout'
import { MarkdownBody, extractHeadings } from '../mdRenderer'
import { DOCS_ENTRIES } from '../docsRegistry'
import { DOCS_CONTENT } from '../docsContent'
import type { DocEntry } from '../docsRegistry'
import { NotFound } from '../NotFound'

interface Props {
  slug:   string
  docs:   DocEntry[]
  onHome: () => void
}

export function DocsSlugPage({ slug, docs, onHome }: Props) {
  const entry = DOCS_ENTRIES.find(e => e.slug === slug)
  const md    = DOCS_CONTENT[slug]

  const headings = useMemo(() => (md ? extractHeadings(md) : []), [md])

  if (!entry || !md) {
    return <NotFound path={`/docs/${slug}`} onHome={onHome} />
  }

  return (
    <>
      <PageHead title={`${entry.title} | Cascade`} description={entry.description} />
      <DocsLayout slug={slug} title={entry.title} headings={headings} docs={docs} onHome={onHome}>
        <MarkdownBody md={md} />
      </DocsLayout>
    </>
  )
}
