/**
 * AppShell — authenticated application chrome.
 * Sidebar (256px ≥1280, 232px 1024–1279, overlay <1024),
 * Topbar (64px / 56px mobile), PageFrame.
 *
 * All wallet logic, ConnectKit flows, WalletGate, receipt behaviour, and
 * ClaimableView are preserved exactly. Only visual structure changed.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { parseEventLogs } from 'viem'
import {
  Menu, Activity as ActivityIcon, Wallet, Plus,
  ChevronRight, AlertCircle, Grid2X2, Loader2, Check, Copy, ExternalLink, ArrowUpRight,
} from 'lucide-react'
import { useClaimable } from '@/hooks/useCascade'
import { useClaim, useSuccessOnce } from '@/hooks/useCascadeWrite'
import { useInvalidateCommitment, useInvalidateUsdcBalance } from '@/hooks/useInvalidate'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import { formatUsdc, shortAddr } from '@/lib/format'
import { TARGET_CHAIN, TARGET_CHAIN_ID, txUrl } from '@/lib/contracts'
import { NETWORK_LABEL, SWITCH_TO_LABEL, IS_MAINNET } from '@/lib/network'
import { cascadeAbi } from '@/lib/cascadeAbi'
import { toastCopied, toastCopyFailed } from '@/lib/toast'
import { claimsFor, triggerRefetch, getSnapshot } from '@/lib/history'
import { LogoMark } from './Layout'
import { PageHeader as PageHeaderUI } from './ui/Layout'
import { Button } from './ui/Button'
import { TxStatus } from './ui/TxStatus'
import { WalletGate } from './ui/WalletGate'
import { ReadError } from './ui/ReadError'
import { EmptyState } from './ui/EmptyState'
import { Amount } from './ui/Amount'
import { AddressDisplay } from './ui/Address'
import { Pill } from './ui/Pill'

/* ── Types ─────────────────────────────────────────────────────────────────── */
export type AppView = 'explore' | 'create' | 'commitment' | 'activity' | 'claims'

interface NavProps {
  view:       AppView
  activeId?:  bigint
  onNavigate: (view: string, id?: bigint) => void
}

/* ── Re-exports for consumers that import PageHeader from AppShell ───────────── */
export { PageHeader } from './ui/Layout'
export type { PageHeaderProps } from './ui/Layout'

/* ── Nav config ─────────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'explore',  label: 'Objectives', Icon: Grid2X2     },
  { id: 'activity', label: 'Activity',   Icon: ActivityIcon },
  { id: 'claims',   label: 'Claimable',  Icon: Wallet      },
] as const

/* ── LearnMore ────────────────────────────────────────────────────────────────── */
function LearnMore({ href }: { href: string }) {
  return (
    <a href={href} className="learn-more-link">
      Learn more <ArrowUpRight size={11} aria-hidden />
    </a>
  )
}

/* ── Claimable balance badge ─────────────────────────────────────────────────── */
function ClaimChip() {
  const { address } = useAccount()
  const { data: claimable } = useClaimable(address)
  if (!claimable || claimable === 0n) return null
  return (
    <span className="shell-claim-chip">
      {formatUsdc(claimable)}
    </span>
  )
}

/* ── Sidebar wallet identity card ────────────────────────────────────────────── */
function SidebarWallet() {
  const { address, isConnected, chainId } = useAccount()
  const { data: balance } = useUsdcBalance(address)
  const wrongChain = isConnected && chainId !== TARGET_CHAIN.id

  return (
    <ConnectKitButton.Custom>
      {({ show }) => (
        <button
          onClick={show}
          style={{
            width:        '100%',
            display:      'flex',
            alignItems:   'center',
            gap:          10,
            background:   'none',
            border:       'none',
            cursor:       'pointer',
            padding:      '10px 8px',
            borderRadius: 10,
            textAlign:    'left',
            transition:   `background var(--dur-fast) var(--ease)`,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--line)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          aria-label="Wallet settings"
        >
          {/* Identicon tile */}
          <span style={{
            width:          32, height: 32,
            background:     wrongChain ? '#FDF3DF' : '#E4EDC9',
            borderRadius:   10,
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            <Wallet size={14} style={{ color: wrongChain ? '#896521' : '#5A7040' }} />
          </span>

          <span style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
            {isConnected && !wrongChain && address ? (
              <>
                <p className="shell-sw-addr">{shortAddr(address)}</p>
                {balance !== undefined && (
                  <p className="shell-sw-balance">
                    {formatUsdc(balance)} <span className="shell-sw-balance-unit">USDC</span>
                  </p>
                )}
                <p className="shell-sw-network">
                  <span className="shell-sw-dot" aria-hidden />
                  {NETWORK_LABEL}
                </p>
              </>
            ) : isConnected && wrongChain ? (
              <>
                <p className="shell-sw-wrong-title">Wrong network</p>
                <p className="shell-sw-wrong-sub">{SWITCH_TO_LABEL}</p>
              </>
            ) : (
              <>
                <p className="shell-sw-disconnected-title">Not connected</p>
                <p className="shell-sw-disconnected-sub">Connect to act</p>
              </>
            )}
          </span>
        </button>
      )}
    </ConnectKitButton.Custom>
  )
}

/* ── Sidebar ─────────────────────────────────────────────────────────────────── */
interface SidebarProps extends NavProps {
  isOpen:  boolean
  onClose: () => void
  scrimId: string
  navId:   string
}

export function Sidebar({ view, activeId: _activeId, onNavigate, isOpen, onClose, scrimId, navId }: SidebarProps) {
  const firstLinkRef = useRef<HTMLButtonElement>(null)

  /* focus into sidebar on open */
  useEffect(() => {
    if (isOpen) setTimeout(() => firstLinkRef.current?.focus(), 50)
  }, [isOpen])

  /* Escape closes */
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (isOpen) { document.addEventListener('keydown', onKey); return () => document.removeEventListener('keydown', onKey) }
  }, [isOpen, onClose])

  const isActive = (id: string) =>
    id === 'explore' ? (view === 'explore' || view === 'commitment') : view === id

  function doNav(v: string) { onNavigate(v); onClose() }

  return (
    <>
      {/* Mobile scrim */}
      <div
        id={scrimId}
        aria-hidden
        onClick={onClose}
        className={`sidebar-scrim${isOpen ? ' sidebar-scrim--open' : ''}`}
        style={{ display: 'none' }}
      />

      {/* Panel */}
      <aside
        id={navId}
        aria-label="Application navigation"
        className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`}
      >
        {/* Logo */}
        <button
          onClick={() => doNav('home')}
          style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            padding:    0,
            margin:     '0 4px 24px',
            textAlign:  'left',
          }}
          className="sidebar-home-btn"
          aria-label="Cascade home"
        >
          <LogoMark size={28} withText />
        </button>

        {/* "New objective" CTA */}
        <Button
          variant="primary"
          size="sm"
          onClick={() => doNav('create')}
          style={{ width: '100%', marginBottom: 20, justifyContent: 'center' }}
        >
          <Plus size={15} strokeWidth={2} />
          New objective
        </Button>

        {/* Nav links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(({ id, label, Icon }, i) => {
            const active = isActive(id)
            return (
              <button
                key={id}
                ref={i === 0 ? firstLinkRef : undefined}
                onClick={() => doNav(id)}
                aria-current={active ? 'page' : undefined}
                style={{
                  position:     'relative',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          12,
                  height:       44,
                  padding:      '0 12px',
                  borderRadius: 10,
                  background:   active ? 'var(--surface)' : 'transparent',
                  border:       'none',
                  cursor:       'pointer',
                  width:        '100%',
                  textAlign:    'left',
                  fontWeight:   600,
                  color:        active ? 'var(--ink)' : 'var(--text-2)',
                  transition:   `background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)`,
                  boxShadow:    active ? '0 1px 3px rgba(18,23,14,.06)' : 'none',
                }}
                onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'rgba(255,255,255,.55)'; el.style.color = 'var(--ink)' } }}
                onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--text-2)' } }}
              >
                {/* Lime active bar */}
                {active && (
                  <span aria-hidden style={{
                    position:     'absolute',
                    left:         0,
                    top:          '50%',
                    transform:    'translateY(-50%)',
                    width:        3,
                    height:       20,
                    background:   'var(--lime)',
                    borderRadius: '0 3px 3px 0',
                  }} />
                )}
                <Icon size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: active ? 'var(--ink)' : 'currentColor' }} />
                {label}
                {id === 'claims' && <ClaimChip />}
              </button>
            )
          })}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Doc / support footer links */}
        <div className="sidebar-footer-links">
          <a href="/docs" className="sidebar-footer-link">Docs</a>
          <span className="sidebar-footer-sep" aria-hidden>·</span>
          <a href="/support" className="sidebar-footer-link">Support</a>
        </div>

        {/* Wallet identity card */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <SidebarWallet />
        </div>
      </aside>
    </>
  )
}

/* ── Topbar ──────────────────────────────────────────────────────────────────── */
interface TopbarProps {
  view:          AppView
  activeId?:     bigint
  onNavigate:    (view: string, id?: bigint) => void
  onMenuToggle:  () => void
  menuOpen:      boolean
  menuBtnId:     string
  navId:         string
}

function pageName(view: AppView, id?: bigint): string {
  switch (view) {
    case 'explore':    return 'Objectives'
    case 'create':     return 'New objective'
    case 'commitment': return id !== undefined ? `Objective #${id.toString()}` : 'Objective'
    case 'activity':   return 'Activity'
    case 'claims':     return 'Claimable'
  }
}

export function Topbar({ view, activeId, onNavigate: _onNavigate, onMenuToggle, menuOpen, menuBtnId, navId }: TopbarProps) {
  const { address, isConnected, isConnecting, isReconnecting, chainId } = useAccount()
  const { data: balance } = useUsdcBalance(address)
  const wrongChain  = isConnected && chainId !== TARGET_CHAIN.id
  const transitioning = isConnecting || isReconnecting
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const [switchErr, setSwitchErr] = useState<string | null>(null)

  function doSwitch() {
    setSwitchErr(null)
    switchChain({ chainId: TARGET_CHAIN_ID }, {
      onError: e => setSwitchErr(e.message?.split('\n')[0] ?? 'Switch failed'),
    })
  }

  return (
    <header className="app-topbar" role="banner">
      <div className="app-topbar-inner">

        {/* Left: hamburger + breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <button
            id={menuBtnId}
            aria-label="Open navigation"
            aria-expanded={menuOpen}
            aria-controls={navId}
            onClick={onMenuToggle}
            className="topbar-menu-btn"
            style={{
              width:          36,
              height:         36,
              background:     'var(--tint)',
              border:         'none',
              borderRadius:   9,
              display:        'none',
              alignItems:     'center',
              justifyContent: 'center',
              cursor:         'pointer',
              flexShrink:     0,
              color:          'var(--ink)',
            }}
          >
            <Menu size={16} strokeWidth={1.75} />
          </button>

          <nav aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
            <span className="shell-breadcrumb-root">Workspace</span>
            <ChevronRight size={12} style={{ color: 'var(--line-strong)', flexShrink: 0 }} />
            <span className="shell-breadcrumb-page">{pageName(view, activeId)}</span>
          </nav>

        </div>

        {/* Right: network + wallet combined control */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} aria-live="polite">

          {wrongChain ? (
            /* Wrong network — badge + switch */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill tone="submitted" size="sm">
                <AlertCircle size={11} aria-hidden />
                Wrong network
              </Pill>
              <button
                className="btn btn-sm btn-primary topbar-chain-badge"
                onClick={doSwitch}
                disabled={isSwitching}
                aria-busy={isSwitching}
                style={{ gap: 6, height: 40, whiteSpace: 'nowrap' }}
              >
                {isSwitching
                  ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />Switching…</>
                  : SWITCH_TO_LABEL}
              </button>
              {switchErr && (
                <span className="shell-switch-err">{switchErr}</span>
              )}
            </div>
          ) : (
            /* Network dot + label */
            <Pill tone="neutral" size="sm" dot dotColor="#8DB82C">
              {NETWORK_LABEL}
            </Pill>
          )}

          {/* Wallet control */}
          <ConnectKitButton.Custom>
            {({ show, truncatedAddress }) => {
              if (transitioning) {
                return (
                  <button
                    className="btn btn-sm topbar-wallet-btn"
                    disabled aria-busy
                    style={{ gap: 6, height: 40, opacity: 0.7 }}
                    aria-label="Connecting…"
                  >
                    <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                    <span className="topbar-wallet-label">Connecting…</span>
                  </button>
                )
              }
              if (isConnected) {
                return (
                  <button
                    onClick={show}
                    className="btn btn-sm topbar-wallet-btn"
                    style={{ gap: 6, height: 40 }}
                    aria-label="Wallet settings"
                  >
                    <Wallet size={13} style={{ flexShrink: 0 }} />
                    <span className="topbar-wallet-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {truncatedAddress ?? shortAddr(address ?? '')}
                      {balance !== undefined && (
                        <span className="shell-topbar-balance">{formatUsdc(balance)}</span>
                      )}
                    </span>
                  </button>
                )
              }
              return (
                <button
                  onClick={show}
                  className="btn btn-sm topbar-wallet-btn"
                  style={{ gap: 6, height: 40 }}
                  aria-label="Connect wallet"
                >
                  <Wallet size={13} />
                  <span className="topbar-wallet-label">Connect wallet</span>
                </button>
              )
            }}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </header>
  )
}

/* ── PageFrame ──────────────────────────────────────────────────────────────── */
export function PageFrame({ children }: { children: React.ReactNode }) {
  return (
    <main className="page-frame" id="main-content" tabIndex={-1}>
      <div className="page-content">
        {children}
      </div>
    </main>
  )
}

/* ── AppShell ────────────────────────────────────────────────────────────────── */
interface AppShellProps {
  view:       AppView
  activeId?:  bigint
  onNavigate: (view: string, id?: bigint) => void
  children:   React.ReactNode
}

export function AppShell({ view, activeId, onNavigate, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const menuBtnId = 'app-menu-btn'
  const navId     = 'app-sidebar-nav'
  const scrimId   = 'app-sidebar-scrim'

  const handleClose = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar
        view={view}
        activeId={activeId}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={handleClose}
        scrimId={scrimId}
        navId={navId}
      />
      <div className="app-shell-body">
        <Topbar
          view={view}
          activeId={activeId}
          onNavigate={onNavigate}
          onMenuToggle={() => setSidebarOpen(s => !s)}
          menuOpen={sidebarOpen}
          menuBtnId={menuBtnId}
          navId={navId}
        />
        <PageFrame>
          {children}
        </PageFrame>
      </div>
    </div>
  )
}

/* ── ClaimableView ───────────────────────────────────────────────────────────── */
type ClaimConfirmed = { amount: bigint | null; address: string; hash: `0x${string}`; blockNumber: bigint | undefined }

function ClaimReceiptCard({ c, onDone }: { c: ClaimConfirmed; onDone: () => void }) {
  const addrRef = useRef<HTMLSpanElement>(null)
  const headRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => { headRef.current?.focus() }, [])

  function copyAddr() {
    navigator.clipboard.writeText(c.address)
      .then(() => toastCopied())
      .catch(() => {
        toastCopyFailed()
        if (addrRef.current) {
          const sel = window.getSelection(); const r = document.createRange()
          r.selectNodeContents(addrRef.current); sel?.removeAllRanges(); sel?.addRange(r)
        }
      })
  }

  const amtStr = c.amount !== null ? formatUsdc(c.amount) : null

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 13, padding: 40, maxWidth: 580 }} className="claim-receipt-card">
      <p role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
        {amtStr ? `Withdrawal confirmed: ${amtStr} USDC sent to ${c.address}.` : 'Withdrawal confirmed.'}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 28 }}>
        <div className="receipt-circle" style={{
          width: 56, height: 56, borderRadius: '50%',
          background: '#D9FA71', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20,
        }}>
          <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#151714" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="receipt-check">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <p className="receipt-kicker">WITHDRAWAL CONFIRMED</p>
        <h2 ref={headRef} tabIndex={-1} className="receipt-heading">Funds received.</h2>

        {amtStr !== null && (
          <div className="receipt-amount" style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
            <span className="receipt-amount-num">{amtStr}</span>
            <span className="receipt-amount-unit">USDC</span>
          </div>
        )}
        <p className="receipt-sent-note">Sent to your wallet on {NETWORK_LABEL}.</p>
      </div>

      <div className="receipt-rows" style={{ borderTop: '1px solid var(--line)', marginBottom: 24 }}>
        {[
          { label: 'Destination', value: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span ref={addrRef} className="receipt-mono">{shortAddr(c.address)}</span>
              <button onClick={copyAddr} title="Copy address" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '2px 4px' }}>
                <Copy size={11} />
              </button>
            </span>
          )},
          { label: 'Status', value: (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#27744E', fontWeight: 650 }}>
              <Check size={11} /> Confirmed
            </span>
          )},
          { label: 'Block', value: <span className="receipt-mono">{c.blockNumber?.toString() ?? '—'}</span> },
          { label: 'Transaction', value: (
            <a href={txUrl(c.hash)} target="_blank" rel="noreferrer" className="receipt-tx-link">
              {shortAddr(c.hash)} <ExternalLink size={10} />
            </a>
          )},
        ].map((row, i) => (
          <div key={i} className={`receipt-row receipt-row-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '1px solid var(--line)', gap: 8 }}>
            <span className="receipt-row-label">{row.label}</span>
            <span className="receipt-row-value">{row.value}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href={txUrl(c.hash)} target="_blank" rel="noreferrer">
          <Button variant="ghost" size="sm">View transaction <ExternalLink size={11} /></Button>
        </a>
        <Button variant="primary" size="sm" onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}

/* ── ClaimableView ─────────────────────────────────────────────────────────── */

/** Parse bigint from raw event arg */
function argBn(v: unknown): bigint {
  const s = (typeof v === 'string' || typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') ? String(v) : '0'
  try { return BigInt(s) } catch { return 0n }
}

/** All CommitmentApproved events that released to a given manager address */
function approvedEventsFor(address: string) {
  const { events } = getSnapshot()
  const addrLc = address.toLowerCase()
  return events.filter(e => {
    if (e.eventName !== 'CommitmentApproved') return false
    const mgrRaw = e.args.manager
    const mgr = (typeof mgrRaw === 'string' || typeof mgrRaw === 'number' || typeof mgrRaw === 'bigint') ? String(mgrRaw).toLowerCase() : ''
    return mgr === addrLc && argBn(e.args.released) > 0n
  })
}

export function ClaimableView({ onNavigate }: { onNavigate: (view: string, id?: bigint) => void }) {
  const { address, isConnected, chainId } = useAccount()
  const wrongChain = isConnected && chainId !== TARGET_CHAIN.id
  const { data: claimable, isLoading: claimLoading, error: claimError, refetch } = useClaimable(address)
  const { claim, isPending, isConfirming, isSuccess, isError, error, reset, hash, receipt } = useClaim()
  const [confirmed, setConfirmed] = useState<ClaimConfirmed | null>(null)
  const invalidateCommitments = useInvalidateCommitment()
  const invalidateBalance     = useInvalidateUsdcBalance()

  // Past Claimed events for the history card — read via claimsFor
  const pastClaims = address ? claimsFor(address) : []
  const totalWithdrawn = pastClaims.reduce((sum, e) => sum + argBn(e.args.amount), 0n)

  // Approved events that earned into this wallet (for "Earned from" list)
  const earnedFrom = address ? approvedEventsFor(address) : []

  // useSuccessOnce — logic unchanged
  useSuccessOnce(isSuccess, hash, () => {
    let amount: bigint | null = null
    try {
      const logs = parseEventLogs({ abi: cascadeAbi, logs: receipt!.logs, eventName: 'Claimed' })
      const args = logs[0]?.args as { account?: string; amount?: bigint } | undefined
      if (args && args.account?.toLowerCase() === address?.toLowerCase()) amount = args.amount ?? null
    } catch { /* fall through */ }
    setConfirmed({ amount, address: address ?? '', hash: hash!, blockNumber: receipt?.blockNumber })
    invalidateCommitments()
    invalidateBalance()
    triggerRefetch()
    void refetch()
    reset()
  })

  const hasBalance = claimable !== undefined && claimable > 0n

  return (
    <div>
      <PageHeaderUI
        kicker="CLAIMABLE USDC"
        title="Claimable"
        description={`Approved contributions become withdrawable USDC. Withdrawal is a wallet transaction confirmed on ${NETWORK_LABEL}.`}
      />

      {/* Receipt replaces the grid while visible */}
      {confirmed && (
        <div className="clm-receipt-wrap">
          <ClaimReceiptCard c={confirmed} onDone={() => { setConfirmed(null); void refetch() }} />
        </div>
      )}

      {!confirmed && (
        <div className="clm-grid">
          {/* ── Left: balance card ─────────────────────────────── */}
          <div className="clm-balance-card">
            <WalletGate isConnected={isConnected} isWrongChain={wrongChain}>
              {claimLoading ? (
                <div className="clm-skeleton">
                  <div className="clm-skel-kicker animate-pulse" />
                  <div className="clm-skel-amount animate-pulse" />
                  <div className="clm-skel-desc   animate-pulse" />
                </div>
              ) : claimError ? (
                <ReadError message={(claimError as Error)?.message} onRetry={() => void refetch()} />
              ) : (
                <>
                  {/* Kicker */}
                  <p className="clm-kicker">Available to withdraw</p>

                  {/* Amount */}
                  <div className="clm-amount-row">
                    <Amount size="xl" value={formatUsdc(claimable ?? 0n)} />
                  </div>

                  {/* Wallet line */}
                  {address && (
                    <p className="clm-wallet-line">
                      on {NETWORK_LABEL} to{' '}
                      <span className="clm-wallet-addr">
                        <AddressDisplay
                          address={address}
                          identicon={false}
                          copy={false}
                          explorer
                        />
                      </span>
                    </p>
                  )}

                  <p className="clm-learn"><LearnMore href="/docs/claiming-usdc" /></p>

                  {IS_MAINNET && (
                    <p className="clm-mainnet-note">This uses real USDC on {NETWORK_LABEL}.</p>
                  )}

                  {/* Primary action */}
                  {hasBalance ? (
                    <Button
                      variant="primary"
                      size="lg"
                      loading={isPending || isConfirming}
                      onClick={() => claim()}
                      style={{ marginTop: 20 }}
                    >
                      {isPending ? 'Confirm in wallet…' : isConfirming ? 'Confirming…'
                        : `Withdraw ${formatUsdc(claimable)} USDC`}
                    </Button>
                  ) : (
                    <EmptyState
                      icon={<Wallet size={28} strokeWidth={1.5} />}
                      title="Nothing to withdraw yet"
                      body="Claimable USDC appears here once your delivered work is approved."
                      action={
                        <Button variant="secondary" size="sm" onClick={() => onNavigate('explore')}>
                          Browse objectives
                        </Button>
                      }
                    />
                  )}

                  {/* TxStatus — logic unchanged */}
                  {(isPending || isConfirming || isSuccess || isError) && (
                    <div style={{ marginTop: 16 }}>
                      <TxStatus
                        isPending={isPending} isConfirming={isConfirming}
                        isSuccess={isSuccess} isError={isError}
                        error={error} hash={hash}
                        successLabel="Withdrawn" onDismiss={reset}
                      />
                    </div>
                  )}

                  {/* "Earned from" list — only when we have approved events */}
                  {hasBalance && earnedFrom.length > 0 && (
                    <div className="clm-earned-from">
                      <p className="clm-earned-label">Earned from</p>
                      {earnedFrom.map((ev, i) => (
                        <div key={i} className="clm-earned-row">
                          <button
                            className="clm-earned-id"
                            onClick={() => onNavigate('commitment', argBn(ev.args.id))}
                          >
                            #{(typeof ev.args.id === 'string' || typeof ev.args.id === 'number' || typeof ev.args.id === 'bigint') ? String(ev.args.id) : '?'}
                          </button>
                          <span className="clm-earned-amt">+{formatUsdc(argBn(ev.args.released))} USDC</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </WalletGate>
          </div>

          {/* ── Right: withdrawal history card ──────────────────── */}
          <div className="clm-history-card">
            <div className="clm-hist-head">
              <span className="clm-hist-title">Withdrawal history</span>
              {pastClaims.length > 0 && (
                <span className="clm-hist-total">
                  Total: <strong>{formatUsdc(totalWithdrawn)}</strong> USDC
                </span>
              )}
            </div>

            {pastClaims.length === 0 ? (
              <div className="clm-hist-empty">
                <p>No withdrawals yet.</p>
              </div>
            ) : (
              <div className="clm-hist-rows">
                {pastClaims.map((ev, i) => {
                  const amt  = argBn(ev.args.amount)
                  const hash = ev.transactionHash
                  return (
                    <div key={i} className="clm-hist-row">
                      <div className="clm-hist-row-left">
                        <span className="clm-hist-block mono">Block {ev.blockNumber.toString()}</span>
                      </div>
                      <span className="clm-hist-amt">+{formatUsdc(amt)} USDC</span>
                      {hash && (
                        <a
                          href={txUrl(hash)}
                          target="_blank"
                          rel="noreferrer"
                          className="clm-hist-tx"
                          aria-label="View transaction"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
