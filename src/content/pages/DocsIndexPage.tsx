import { PageHead } from '../PageHead'
import { DocsLayout } from '../DocsLayout'
import { contentNavigate } from '@/router'
import { DOCS_ENTRIES } from '../docsRegistry'
import type { DocEntry } from '../docsRegistry'
import { NETWORK_LABEL } from '@/lib/network'

interface Props { docs: DocEntry[]; onHome: () => void }

export function DocsIndexPage({ docs, onHome }: Props) {
  // Build groups preserving insertion order
  const groupOrder: string[] = []
  const groups: Record<string, typeof DOCS_ENTRIES> = {}
  for (const entry of DOCS_ENTRIES) {
    if (!groups[entry.section]) {
      groups[entry.section] = []
      groupOrder.push(entry.section)
    }
    groups[entry.section].push(entry)
  }

  return (
    <>
      <PageHead
        title="Documentation | Cascade"
        description="Learn how Cascade works: quick start, core concepts, usage guides and developer reference."
      />
      <DocsLayout slug="overview" title="Documentation" headings={[]} docs={docs} onHome={onHome}>
        <h1 className="md-h1">Documentation</h1>
        <p className="md-p">
          Cascade is a programmable financial-authority protocol on {NETWORK_LABEL}. Browse by topic
          below, or use the sidebar to jump to any article.
        </p>

        {groupOrder.map(section => (
          <div key={section} className="docs-index-section">
            <h2 className="md-h2" style={{ marginTop: 40 }}>{section}</h2>
            <div className="docs-index-grid">
              {groups[section].map(entry => (
                <a
                  key={entry.slug}
                  href={`/docs/${entry.slug}`}
                  onClick={e => { e.preventDefault(); contentNavigate(`/docs/${entry.slug}`) }}
                  className="docs-index-card"
                >
                  <span className="docs-index-card-title">{entry.title}</span>
                  <span className="docs-index-card-desc">{entry.description}</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </DocsLayout>
    </>
  )
}
