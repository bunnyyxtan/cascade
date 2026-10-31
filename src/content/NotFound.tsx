import { contentNavigate } from '@/router'
import { LogoMark } from '@/components/Layout'

export function NotFound({ path, onHome }: { path: string; onHome: () => void }) {
  return (
    <div className="notfound-root">
      <header className="docs-topbar">
        <div className="docs-topbar-inner">
          <button onClick={onHome} className="docs-topbar-logo" aria-label="Cascade home">
            <LogoMark size={28} withText />
          </button>
        </div>
      </header>
      <main className="notfound-body" id="main-content">
        <p className="notfound-code" aria-hidden="true">404</p>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-sub">
          <code className="md-inline-code">{path}</code> doesn't exist on this site.
        </p>
        <div className="notfound-actions">
          <button
            className="btn btn-sm"
            onClick={onHome}
          >
            Go home
          </button>
          <a
            href="/docs"
            onClick={e => { e.preventDefault(); contentNavigate('/docs') }}
            className="btn btn-sm btn-secondary"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  )
}
