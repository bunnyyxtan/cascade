/**
 * PageHead — updates document.title, meta description, canonical,
 * and robots per-route. Uses useEffect so it runs on every render.
 */
import { useEffect } from 'react'

const SITE_URL = import.meta.env.VITE_SITE_URL as string | undefined

interface PageHeadProps {
  title: string          // "Page | Cascade" or "Cascade" for the homepage
  description?: string
  noIndex?: boolean      // draft legal pages
}

export function PageHead({ title, description, noIndex }: PageHeadProps) {
  useEffect(() => {
    // Title
    document.title = title

    // Meta description
    let descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!descEl) {
      descEl = document.createElement('meta')
      descEl.name = 'description'
      document.head.appendChild(descEl)
    }
    if (description) descEl.content = description

    // Canonical
    let canonEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (SITE_URL) {
      if (!canonEl) {
        canonEl = document.createElement('link')
        canonEl.rel = 'canonical'
        document.head.appendChild(canonEl)
      }
      canonEl.href = SITE_URL.replace(/\/$/, '') + window.location.pathname
    } else if (canonEl) {
      canonEl.remove()
    }

    // Robots noindex for draft pages
    let robotsEl = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (noIndex) {
      if (!robotsEl) {
        robotsEl = document.createElement('meta')
        robotsEl.name = 'robots'
        document.head.appendChild(robotsEl)
      }
      robotsEl.content = 'noindex'
    } else if (robotsEl) {
      robotsEl.remove()
    }

    return () => {
      document.title = 'Cascade'
    }
  }, [title, description, noIndex])

  return null
}
