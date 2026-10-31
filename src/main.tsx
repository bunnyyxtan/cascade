/*
 *  ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗
 *  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
 *  ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 *  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝
 *
 *  Built with Arc Studio
 *  https://studio.arc.io
 */

import { StrictMode, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import { Toaster } from 'sonner'
import { config } from './config'
import { CHAIN_ID, RPC_URL, NETWORK_LABEL, IS_MAINNET } from './lib/network'
import App from './App'
import { ContentApp } from './content/ContentApp'
import { parsePathname } from './router'
import WalletToastWatcher from './components/WalletToastWatcher'
import './index.css'

// ── Arc Studio instrumentation (Studio iframe only) ───────────────────────────
// Load tracing + console-capture only when running inside a Studio preview frame.
// The guard checks ancestorOrigins (Chromium/Safari) and document.referrer.
;(function loadStudioInstrumentation() {
  if (window.self === window.top) return // not in an iframe at all
  try {
    const studioPattern = /studio\.arc\.io$/
    const origin0 = window.location.ancestorOrigins?.[0]
    const isStudio =
      (origin0 && studioPattern.test(new URL(origin0).hostname)) ||
      (document.referrer ? studioPattern.test(new URL(document.referrer).hostname) : false)
    if (!isStudio) return
  } catch {
    return // sandboxed iframe with no accessible origin info — skip
  }
  void Promise.all([import('./tracing'), import('./console-capture')]).then(([tracing]) => {
    // Register chain→RPC so the trace panel shows the correct chain from the first call.
    tracing.registerChain(CHAIN_ID, RPC_URL)
  })
})()

const CK_THEME = {
  '--ck-font-family': '"Hanken Grotesk", system-ui, sans-serif',
  // Modal chrome
  '--ck-border-radius': '18px',
  '--ck-body-background': '#FFFFFF',
  '--ck-body-box-shadow': '0 30px 110px rgba(23,32,19,0.20), 0 0 0 1px #E8EBDF',
  '--ck-modal-box-shadow': '0 30px 110px rgba(23,32,19,0.20)',
  '--ck-overlay-background': 'rgba(17,21,15,0.43)',
  // Body text
  '--ck-body-color': '#151714',
  '--ck-body-color-muted': '#4F584C',
  '--ck-body-color-muted-hover': '#151714',
  '--ck-body-color-danger': '#B64D4A',
  '--ck-body-color-valid': '#27744E',
  // Dividers
  '--ck-body-divider': '#E3E6DD',
  '--ck-body-background-primary': '#FFFFFF',
  '--ck-body-background-secondary': '#F8F8F5',
  '--ck-body-background-tertiary': '#F0F2EC',
  // Primary button (Approve / Connect etc)
  '--ck-primary-button-background': '#151714',
  '--ck-primary-button-color': '#FFFFFF',
  '--ck-primary-button-border-radius': '10px',
  '--ck-primary-button-box-shadow': 'none',
  '--ck-primary-button-hover-background': '#252823',
  '--ck-primary-button-hover-color': '#FFFFFF',
  '--ck-primary-button-hover-box-shadow': 'none',
  '--ck-primary-button-font-weight': '650',
  // Secondary buttons
  '--ck-secondary-button-background': '#FFFFFF',
  '--ck-secondary-button-color': '#151714',
  '--ck-secondary-button-border-radius': '10px',
  '--ck-secondary-button-box-shadow': '0 0 0 1px #E3E6DD',
  '--ck-secondary-button-hover-background': '#F8FAF3',
  '--ck-secondary-button-hover-box-shadow': '0 0 0 1px #9FB087',
  '--ck-secondary-button-font-weight': '600',
  // Focus
  '--ck-focus-color': '#719B39',
  // Disclaimer area
  '--ck-body-disclaimer-background': '#F0F2EC',
  '--ck-body-disclaimer-color': '#4F584C',
  '--ck-body-disclaimer-font-size': '12px',
  '--ck-body-disclaimer-font-weight': '500',
  '--ck-body-disclaimer-link-color': '#151714',
  '--ck-body-disclaimer-link-hover-color': '#252823',
  // Spinner
  '--ck-spinner-color': '#151714',
  // Accent (QR dot, highlights)
  '--ck-accent-color': '#D9FA71',
  '--ck-accent-text-color': '#151714',
}

const CK_OPTIONS = {
  initialChainId: CHAIN_ID,
  hideBalance: true,
  overlayBlur: 5,
  disclaimer: `Cascade runs on ${NETWORK_LABEL}. Connecting does not move funds; every transaction asks for your signature.${IS_MAINNET ? ' This uses real USDC.' : ''}`,
  embedGoogleFonts: false,
  avoidLayoutShift: true,
}

const queryClient = new QueryClient()

// Studio logo SVG
const StudioLogo = () => (
  <svg width="14" height="16" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 21.5001C0.167192 16.2366 1.02308 11.3243 2.45378 7.50459C4.26573 2.66517 6.88869 0 9.83904 0C12.7894 0 15.412 2.66517 17.2243 7.50459C18.1669 10.0216 18.8605 13.0121 19.2713 16.2655C19.3081 16.556 19.3393 16.8513 19.3714 17.146C19.3819 17.1642 19.3881 17.1811 19.386 17.1949C19.386 17.1949 19.6275 18.7674 19.6788 21.5001H19.6515C19.2934 21.1937 15.0694 17.7329 8.06739 18.735C8.17304 17.4996 8.31833 16.2974 8.50603 15.1452C8.51562 15.0863 8.52671 15.0294 8.53649 14.9709C11.2828 14.8846 13.6866 15.2171 15.5299 15.6529C15.5231 15.6073 15.5173 15.5603 15.5103 15.5149C15.1314 13.0547 14.5724 10.8024 13.8517 8.87761C12.6732 5.73037 11.1354 3.77496 9.83904 3.77496C8.54269 3.77496 7.00493 5.73037 5.82649 8.87761C5.54123 9.63889 5.28154 10.4508 5.04866 11.3071C4.72126 12.507 4.44621 13.7934 4.22654 15.1451C3.90141 17.1412 3.69827 19.2821 3.62345 21.5001H0Z" fill="currentColor"/>
  </svg>
)

// Studio watermark component - links back to Studio
const StudioWatermark = () => (
  <a
    href="https://studio.arc.io/"
    target="_blank"
    rel="noopener noreferrer"
    style={{
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 600,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1B3158',
      textDecoration: 'none',
      cursor: 'pointer',
      background: 'rgba(172, 198, 233, 0.85)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      borderRadius: '20px',
      border: '1px solid rgba(255, 255, 255, 0.4)',
      zIndex: 9999,
      boxShadow: '0 4px 20px rgba(27, 49, 88, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
    }}
  >
    <StudioLogo />
    Built with Arc Studio
  </a>
)

// ── pathname store (useSyncExternalStore) ─────────────────────────────────────
// Subscribes to popstate so any pushState/replaceState triggers a re-render.
function subscribePathname(cb: () => void) {
  window.addEventListener('popstate', cb)
  return () => window.removeEventListener('popstate', cb)
}
function getPathname() { return window.location.pathname }

/**
 * Root — reactive router root.
 * Renders <ContentApp/> for content routes (parsePathname returns non-null)
 * and <App/> for the hash-based workspace (pathname === '/' or '').
 * Switches live on every popstate, so clicking "Docs" or the logo works
 * without a full page reload.
 */
function Root() {
  const pathname = useSyncExternalStore(subscribePathname, getPathname, getPathname)
  const isContent = parsePathname(pathname) !== null

  if (isContent) return <ContentApp />
  return (
    <>
      <App />
      <WalletToastWatcher />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider customTheme={CK_THEME} options={CK_OPTIONS}>
          <Root />
          <StudioWatermark />
          <Toaster
            position="bottom-right"
            toastOptions={{ unstyled: true, classNames: { toast: 'cascade-toast' } }}
            offset={{ bottom: 24, right: 24 }}
          />
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)

