/**
 * WalletGate — blocks children when:
 *   - disconnected
 *   - wrong chain
 *   - contract not verified (config not ok)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WalletGate } from '@/components/ui/WalletGate'

/* ── Stub the wagmi / connectkit hooks WalletGate calls ─────────────────────── */
vi.mock('wagmi', () => ({
  useAccount:     () => ({ chainId: undefined }),
  useSwitchChain: () => ({ switchChain: vi.fn(), isPending: false }),
}))
vi.mock('connectkit', () => ({
  ConnectKitButton: {
    Custom: ({ children }: { children: (p: { show: () => void }) => React.ReactNode }) =>
      children({ show: vi.fn() }),
  },
}))

/* ── Stub the config check so we can control its return value ─────────────── */
const mockConfigResult = {
  status: 'ok' as 'ok' | 'loading' | 'error' | 'unverified' | 'mismatch' | 'not-deployed',
  key: 'cascade-test' as string,
  detail: undefined as string | undefined,
  expected: undefined as string | undefined,
  actual: undefined as string | undefined,
}
vi.mock('@/lib/configCheck', () => ({
  useConfigCheck:      () => mockConfigResult,
  retryConfigCheck:    vi.fn(),
  useChainIdWatcher:   vi.fn(),
  EXPECTED_CONFIG_KEY: 'cascade-test',
}))

/* ── Stub network / contract constants ──────────────────────────────────────── */
vi.mock('@/lib/network',    () => ({ NETWORK_LABEL: 'Arc Testnet', SWITCH_TO_LABEL: 'Switch to Arc Testnet' }))
vi.mock('@/lib/contracts',  () => ({ TARGET_CHAIN_ID: 5042002 }))

/** Unique test-id for the child element — avoids false-positive text matches. */
const CHILD_TESTID = 'gate-child-sentinel'
const CHILD = <span data-testid={CHILD_TESTID}>children content</span>

describe('WalletGate', () => {
  beforeEach(() => {
    mockConfigResult.status = 'ok'
    mockConfigResult.key    = 'cascade-test'
  })

  it('disconnected — blocks children and shows connect prompt', () => {
    render(<WalletGate isConnected={false} isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
    expect(screen.getByText(/connect a wallet/i)).toBeTruthy()
  })

  it('wrong chain — blocks children and shows switch prompt', () => {
    render(<WalletGate isConnected isWrongChain>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
    expect(screen.getAllByText(/switch to arc testnet/i).length).toBeGreaterThan(0)
  })

  it('connected + right chain + ok config — shows children', () => {
    render(<WalletGate isConnected isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.getByTestId(CHILD_TESTID)).toBeTruthy()
  })

  it('connected + right chain + loading config — blocks children', () => {
    mockConfigResult.status = 'loading'
    render(<WalletGate isConnected isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
    expect(screen.getByText(/verifying/i)).toBeTruthy()
  })

  it('connected + right chain + error config — blocks children and shows retry', () => {
    mockConfigResult.status = 'error'
    render(<WalletGate isConnected isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
    expect(screen.getByText(/retry/i)).toBeTruthy()
  })

  it('connected + right chain + unverified config — blocks children', () => {
    mockConfigResult.status = 'unverified'
    render(<WalletGate isConnected isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
  })

  it('connected + right chain + key mismatch — blocks children', () => {
    mockConfigResult.status = 'ok'
    mockConfigResult.key    = 'wrong-key'
    render(<WalletGate isConnected isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
    expect(screen.getByText(/verifying/i)).toBeTruthy()
  })

  it('mismatch status — blocks children and shows retry', () => {
    mockConfigResult.status = 'mismatch'
    mockConfigResult.key    = 'cascade-test'
    render(<WalletGate isConnected isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
    expect(screen.getByText(/retry/i)).toBeTruthy()
  })

  it('not-deployed status — blocks children and shows retry', () => {
    mockConfigResult.status = 'not-deployed'
    mockConfigResult.key    = 'cascade-test'
    render(<WalletGate isConnected isWrongChain={false}>{CHILD}</WalletGate>)
    expect(screen.queryByTestId(CHILD_TESTID)).toBeNull()
    expect(screen.getByText(/retry/i)).toBeTruthy()
  })
})
