/**
 * Pathname router — handles /docs, /docs/:slug, /security,
 * /usage-risks, /terms (→ redirects to /usage-risks), /privacy, /faq, /support.
 *
 * Everything on "/" (hash-based) is left entirely to App.tsx.
 * This module only activates when window.location.pathname !== '/'.
 */

export type ContentRoute =
  | { type: 'docs-index' }
  | { type: 'docs-slug';    slug: string }
  | { type: 'security' }
  | { type: 'usage-risks' }
  | { type: 'privacy' }
  | { type: 'faq' }
  | { type: 'support' }
  | { type: 'not-found'; path: string }

export function parsePathname(pathname: string): ContentRoute | null {
  // Normalise trailing slash
  const p = pathname.replace(/\/$/, '') || '/'
  if (p === '/' || p === '') return null // hash router territory

  if (p === '/docs') return { type: 'docs-index' }
  const docsSlug = p.match(/^\/docs\/([a-z0-9-]+)$/)
  if (docsSlug) return { type: 'docs-slug', slug: docsSlug[1] }
  if (p === '/security')    return { type: 'security' }
  if (p === '/usage-risks') return { type: 'usage-risks' }
  if (p === '/terms')       return { type: 'usage-risks' } // permanent redirect
  if (p === '/privacy')     return { type: 'privacy' }
  if (p === '/faq')         return { type: 'faq' }
  if (p === '/support')     return { type: 'support' }

  return { type: 'not-found', path: pathname }
}

/** Navigate to a content path without a full reload. */
export function contentNavigate(path: string) {
  // /terms is a permanent redirect to /usage-risks
  const resolved = path === '/terms' ? '/usage-risks' : path
  if (window.location.pathname === resolved) return
  window.history.pushState({}, '', resolved)
  window.dispatchEvent(new PopStateEvent('popstate'))
  // Scroll to top on page change, but not for in-page anchor jumps
  if (!path.includes('#')) {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
}

/** Call once: intercept <a href="/..."> clicks so they use the router. */
export function installLinkInterceptor() {
  document.addEventListener('click', (e) => {
    const target = (e.target as Element).closest('a')
    if (!target) return
    const href = target.getAttribute('href')
    if (!href) return
    // Only intercept same-origin absolute paths starting with /
    if (href.startsWith('/') && !href.startsWith('//')) {
      // Let hash links and external links pass through
      const url = new URL(href, window.location.href)
      if (url.origin !== window.location.origin) return
      // If it's a pure hash link on the same page, leave it
      if (url.pathname === '/' && url.hash) return
      // Intercept content routes
      const route = parsePathname(url.pathname)
      if (route !== null) {
        e.preventDefault()
        contentNavigate(url.pathname + url.search + url.hash)
      }
    }
  })
}
