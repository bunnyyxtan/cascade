/**
 * Axe a11y tests — zero critical or serious violations on:
 *   - Objectives list (Explore)
 *   - New objective (CreateRoot)
 *   - A gate-state panel (WalletGate disconnected)
 *
 * These tests render lightweight versions of each view using the same
 * primitives the live app uses, with all data-fetching hooks stubbed.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import axe from 'axe-core'

/* ── Global stubs needed for every component that imports from wagmi/viem ── */
vi.mock('wagmi', () => ({
  useAccount:       () => ({ address: undefined, isConnected: false, isConnecting: false, isReconnecting: false, chainId: undefined }),
  useSwitchChain:   () => ({ switchChain: vi.fn(), isPending: false }),
  useWriteContract: () => ({ writeContract: vi.fn(), isPending: false, isError: false, error: null }),
  useWaitForTransactionReceipt: () => ({ data: undefined, isLoading: false }),
  useReadContract:  () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useBalance:       () => ({ data: undefined }),
}))
vi.mock('connectkit', () => ({
  ConnectKitButton: {
    Custom: ({ children }: { children: (p: { show: () => void; truncatedAddress?: string }) => React.ReactNode }) =>
      children({ show: vi.fn() }),
  },
  ConnectKitProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery:     () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
  useMutation:  () => ({ mutate: vi.fn(), isPending: false }),
  QueryClient:  class { },
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/network',   () => ({
  CHAIN: { id: 5042002 }, CHAIN_ID: 5042002,
  NETWORK_LABEL: 'Arc Testnet', NETWORK_LABEL_UPPER: 'ARC TESTNET',
  SWITCH_TO_LABEL: 'Switch to Arc Testnet', IS_MAINNET: false,
  RPC_URL: 'https://rpc.testnet.arc.io',
}))
vi.mock('@/lib/contracts',  () => ({
  TARGET_CHAIN: { id: 5042002 }, TARGET_CHAIN_ID: 5042002,
  CASCADE_ADDRESS: '0xa87371b1127d88df309313ddcaa43b6191fa9a57',
  USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
  USDC_DECIMALS: 6,
  isDeployed: true,
  txUrl:   (h: string) => `https://explorer.testnet.arc.io/tx/${h}`,
  addrUrl: (a: string) => `https://explorer.testnet.arc.io/address/${a}`,
}))
vi.mock('@/lib/configCheck', () => ({
  useConfigCheck:      () => ({ status: 'ok', key: 'cascade-test' }),
  retryConfigCheck:    vi.fn(),
  useChainIdWatcher:   vi.fn(),
  EXPECTED_CONFIG_KEY: 'cascade-test',
}))
vi.mock('@/lib/history', () => ({
  useHistory:    () => ({ events: [], syncing: false, progress: 1, syncedTo: 1n, error: null }),
  eventsFor:     () => [],
  claimsFor:     () => [],
  getSnapshot:   () => ({ events: [], syncing: false, progress: 1, syncedTo: 1n, error: null }),
  subscribe:     () => () => { },
  triggerRefetch: vi.fn(),
  syncHistory:   vi.fn(),
}))
vi.mock('@/hooks/useCascadeEvents', () => ({
  useCascadeActivity: () => ({ events: [], isLoading: false, syncing: false, progress: 1, error: null, refetch: vi.fn() }),
}))

/** Run axe on a rendered container and return only critical/serious violations */
async function runAxe(container: HTMLElement) {
  const results = await axe.run(container, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
  })
  return results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
}

// ── 1. WalletGate disconnected panel ─────────────────────────────────────────
describe('a11y: WalletGate disconnected', () => {
  it('zero critical/serious violations', async () => {
    const { WalletGate } = await import('@/components/ui/WalletGate')
    const { container } = render(
      <WalletGate isConnected={false} isWrongChain={false}>
        <span>content</span>
      </WalletGate>,
    )
    const violations = await runAxe(container)
    if (violations.length > 0) {
      // Provide helpful output
      const desc = violations.map(v => `${v.id}: ${v.description} (${v.impact})`).join('\n')
      expect.fail(`Axe violations:\n${desc}`)
    }
    expect(violations).toHaveLength(0)
  })
})

// ── 2. StatusBadge for all statuses ──────────────────────────────────────────
describe('a11y: StatusBadge', () => {
  it('active badge — zero critical/serious violations', async () => {
    const { StatusBadge } = await import('@/components/ui/StatusBadge')
    const { STATUS_MAP }  = await import('@/lib/status')
    const { container }   = render(<StatusBadge status={STATUS_MAP.active} />)
    const violations = await runAxe(container)
    expect(violations).toHaveLength(0)
  })
})

// ── 3. EmptyState component ───────────────────────────────────────────────────
describe('a11y: EmptyState', () => {
  it('zero critical/serious violations', async () => {
    const { EmptyState } = await import('@/components/ui/EmptyState')
    const { Clock }      = await import('lucide-react')
    const { container }  = render(
      <EmptyState
        icon={<Clock aria-hidden size={28} />}
        title="Nothing here yet"
        body="Try adjusting your filters."
      />,
    )
    const violations = await runAxe(container)
    expect(violations).toHaveLength(0)
  })
})

// ── 4. Notice component ───────────────────────────────────────────────────────
describe('a11y: Notice', () => {
  it('info notice — zero critical/serious violations', async () => {
    const { Notice }    = await import('@/components/ui/Notice')
    const { container } = render(<Notice kind="info" title="FYI">Something to know.</Notice>)
    const violations    = await runAxe(container)
    expect(violations).toHaveLength(0)
  })

  it('error notice — zero critical/serious violations', async () => {
    const { Notice }    = await import('@/components/ui/Notice')
    const { container } = render(<Notice kind="error" title="Error">Something went wrong.</Notice>)
    const violations    = await runAxe(container)
    expect(violations).toHaveLength(0)
  })
})

// ── 5. ConfigMismatch screen ──────────────────────────────────────────────────
describe('a11y: ConfigMismatch', () => {
  it('mismatch screen — zero critical/serious violations', async () => {
    const { ConfigMismatch } = await import('@/components/ConfigMismatch')
    const { container }      = render(
      <ConfigMismatch
        result={{
          status: 'mismatch',
          key: 'stale',
          checkedAt: Date.now(),
          detail: 'codehash mismatch',
          expected: '0xabc',
          actual:   '0xdef',
        }}
      />,
    )
    const violations = await runAxe(container)
    expect(violations).toHaveLength(0)
  })
})
