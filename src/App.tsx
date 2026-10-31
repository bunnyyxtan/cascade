import { useState, useCallback, useEffect } from 'react'
import { Layout }               from './components/Layout'
import { Landing }              from './components/Landing'
import { CreateRoot }           from './components/CreateRoot'
import { CommitmentWorkspace }  from './components/CommitmentWorkspace'
import { Explore }              from './components/Explore'
import { Activity }             from './components/Activity'
import { AppShell, ClaimableView } from './components/AppShell'
import type { AppView }         from './components/AppShell'
import { ConfigMismatch }       from './components/ConfigMismatch'
import { useConfigCheck, EXPECTED_CONFIG_KEY } from './hooks/useConfigCheck'

type View = 'home' | AppView

const APP_VIEWS: View[] = ['explore', 'create', 'commitment', 'activity', 'claims']

function hashForView(view: View, id?: bigint): string {
  if (view === 'commitment' && id !== undefined) return `commitment/${id.toString()}`
  if (view === 'explore')  return 'explore'
  if (view === 'create')   return 'create'
  if (view === 'activity') return 'activity'
  if (view === 'claims')   return 'claims'
  return ''
}

export default function App() {
  const configCheck = useConfigCheck()
  const [view,     setView]     = useState<View>('home')
  const [activeId, setActiveId] = useState<bigint | undefined>()

  /* deep-link parsing */
  useEffect(() => {
    function parseHash() {
      const hash = window.location.hash.replace('#', '')
      if (!hash) { setView('home'); return }
      const [segment, idStr] = hash.split('/')
      if (segment === 'commitment' && idStr) {
        const id = BigInt(idStr)
        if (id > 0n) { setView('commitment'); setActiveId(id); return }
      }
      if (APP_VIEWS.includes(segment as AppView)) {
        setView(segment as AppView)
        return
      }
    }
    parseHash()
    window.addEventListener('hashchange', parseHash)
    return () => window.removeEventListener('hashchange', parseHash)
  }, [])

  const navigate = useCallback((newView: string, id?: bigint) => {
    setView(newView as View)
    setActiveId(id)
    const h = hashForView(newView as View, id)
    window.location.hash = h
  }, [])

  // Fail-closed config check — show mismatch panel for hard failures.
  // 'mismatch' and 'not-deployed' replace the entire app.
  // 'loading', 'ok', 'error', 'unverified' let the app render; WalletGate gates writes.
  const isMismatch =
    (configCheck.status === 'mismatch' || configCheck.status === 'not-deployed') &&
    configCheck.key === EXPECTED_CONFIG_KEY
  if (isMismatch) {
    return <ConfigMismatch result={configCheck} />
  }

  const isAppView = view !== 'home'

  if (!isAppView) {
    return (
      <Layout onNavigate={navigate} fullBleed>
        <Landing onNavigate={navigate} />
      </Layout>
    )
  }

  return (
    <AppShell view={view} activeId={activeId} onNavigate={navigate}>
      {view === 'explore'    && <Explore onNavigate={navigate} />}
      {view === 'create'     && <CreateRoot onNavigate={navigate} />}
      {view === 'activity'   && <Activity />}
      {view === 'claims'     && <ClaimableView onNavigate={navigate} />}
      {view === 'commitment' && activeId !== undefined && (
        <CommitmentWorkspace id={activeId} onNavigate={navigate} />
      )}
      {view === 'commitment' && activeId === undefined && <Explore onNavigate={navigate} />}
    </AppShell>
  )
}
