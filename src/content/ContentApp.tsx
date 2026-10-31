/**
 * ContentApp — renders pathname-routed content pages.
 * Activated by main.tsx when window.location.pathname !== '/'.
 * Uses the pathname router (src/router.ts); hash-based app routes
 * are handled by App.tsx and are not affected.
 *
 * Unpublished pages (PUBLISHED[key] === false) render NotFound.
 */
import { useState, useEffect } from 'react'
import { parsePathname, installLinkInterceptor } from '@/router'
import type { ContentRoute } from '@/router'
import { isPublished }       from './site'
import { DocsIndexPage }     from './pages/DocsIndexPage'
import { DocsSlugPage }      from './pages/DocsSlugPage'
import { SecurityPage }      from './pages/SecurityPage'
import { FaqPage }           from './pages/FaqPage'
import { SupportPage }       from './pages/SupportPage'
import { UsageRisksPage }    from './pages/UsageRisksPage'
import { PrivacyPage }       from './pages/PrivacyPage'
import { NotFound }          from './NotFound'
import { DOCS_ENTRIES }      from './docsRegistry'
import type { DocEntry }     from './docsRegistry'

// Build the docs array for search (headings populated per-page)
const DOCS: DocEntry[] = DOCS_ENTRIES.map(e => ({ ...e, headings: [] }))

let interceptorInstalled = false

export function ContentApp() {
  const [route, setRoute] = useState<ContentRoute | null>(() =>
    parsePathname(window.location.pathname)
  )

  useEffect(() => {
    function onPopState() {
      setRoute(parsePathname(window.location.pathname))
    }
    window.addEventListener('popstate', onPopState)
    if (!interceptorInstalled) {
      installLinkInterceptor()
      interceptorInstalled = true
    }
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // Navigate to home: push '/' then dispatch popstate to re-render App.tsx
  function goHome() {
    window.history.pushState({}, '', '/')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  if (!route) return null // shouldn't happen inside ContentApp

  switch (route.type) {
    case 'docs-index':
      return <DocsIndexPage docs={DOCS} onHome={goHome} />
    case 'docs-slug':
      return <DocsSlugPage slug={route.slug} docs={DOCS} onHome={goHome} />
    case 'security':
      return isPublished('security')
        ? <SecurityPage docs={DOCS} onHome={goHome} />
        : <NotFound path="/security" onHome={goHome} />
    case 'faq':
      return isPublished('faq')
        ? <FaqPage docs={DOCS} onHome={goHome} />
        : <NotFound path="/faq" onHome={goHome} />
    case 'support':
      return isPublished('support')
        ? <SupportPage docs={DOCS} onHome={goHome} />
        : <NotFound path="/support" onHome={goHome} />
    case 'usage-risks':
      return isPublished('usage-risks')
        ? <UsageRisksPage onHome={goHome} />
        : <NotFound path="/usage-risks" onHome={goHome} />
    case 'privacy':
      return isPublished('privacy')
        ? <PrivacyPage onHome={goHome} />
        : <NotFound path="/privacy" onHome={goHome} />
    case 'not-found':
      return <NotFound path={route.path} onHome={goHome} />
  }
}
