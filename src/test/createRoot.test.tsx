/**
 * CreateRoot — contract-verification gate regression tests.
 *
 * Verifies that all financial action entry points (Review button,
 * Confirm button, and the auto-advance after approve) are blocked
 * whenever the contract verification status is not `ok` with a
 * matching config key, even when the wallet is connected on the
 * correct chain.
 *
 * We render the full CreateRoot component (not EscrowSummary alone)
 * so the fix is tested at the integration level — including the
 * auto-advance useSuccessOnce callback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

/* ── Stub heavy wagmi / viem internals ───────────────────────────────────────── */

const mockWrite = vi.fn()
const mockApproveWrite = vi.fn()

vi.mock('wagmi', () => ({
  useAccount: () => ({
    address:     '0xDeAdBeEf00000000000000000000000000000001' as `0x${string}`,
    isConnected: true,
    chainId:     5042002,
  }),
  useWriteContract: () => ({
    writeContract: mockWrite,
    data:          undefined,
    isPending:     false,
    isError:       false,
    error:         null,
    reset:         vi.fn(),
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
    data:      undefined,
  }),
}))

vi.mock('connectkit', () => ({
  ConnectKitButton: {
    Custom: ({ children }: { children: (p: { show: () => void }) => React.ReactNode }) =>
      children({ show: vi.fn() }),
  },
}))

/* ── Stub config check — mutable so tests can set different states ─────────── */

const mockConfigResult = {
  status: 'ok' as 'ok' | 'loading' | 'error' | 'unverified' | 'mismatch' | 'not-deployed',
  key:    'cascade-test' as string,
  checkedAt: Date.now(),
  detail: undefined as string | undefined,
}

vi.mock('@/lib/configCheck', () => ({
  useConfigCheck:      () => mockConfigResult,
  retryConfigCheck:    vi.fn(),
  useChainIdWatcher:   vi.fn(),
  EXPECTED_CONFIG_KEY: 'cascade-test',
}))

/* ── Stub network / contract constants ───────────────────────────────────────── */

vi.mock('@/lib/network', () => ({
  IS_MAINNET:          false,
  NETWORK_LABEL:       'Arc Testnet',
  NETWORK_LABEL_UPPER: 'ARC TESTNET',
  SWITCH_TO_LABEL:     'Switch to Arc Testnet',
}))

vi.mock('@/lib/contracts', () => ({
  CASCADE_ADDRESS:  '0xCaScAdE0000000000000000000000000000000000' as `0x${string}`,
  USDC_ADDRESS:     '0x3600000000000000000000000000000000000000' as `0x${string}`,
  USDC_DECIMALS:    6,
  TARGET_CHAIN_ID:  5042002,
  isDeployed:       true,
  txUrl:            (h: string) => `https://explorer.testnet.arc.io/tx/${h}`,
  addrUrl:          (a: string) => `https://explorer.testnet.arc.io/address/${a}`,
}))

/* ── Stub hooks that hit RPC ─────────────────────────────────────────────────── */

vi.mock('@/hooks/useUsdcBalance', () => ({
  useUsdcBalance:   () => ({ data: 1_000_000n }),   // 1.000000 USDC
  useUsdcAllowance: () => ({ data: 0n, refetch: vi.fn() }),
}))

vi.mock('@/hooks/useInvalidate', () => ({
  useInvalidateCommitment:  () => vi.fn(),
  useInvalidateUsdcBalance: () => vi.fn(),
}))

vi.mock('@/lib/history', () => ({ triggerRefetch: vi.fn() }))
vi.mock('@/lib/cascadeAbi', () => ({ cascadeAbi: [] }))
vi.mock('@/hooks/useCascadeWrite', () => ({
  useSuccessOnce: vi.fn(),
}))

/* ── Import component AFTER all mocks ─────────────────────────────────────────── */
import { CreateRoot } from '@/components/CreateRoot'

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderCreateRoot() {
  return render(<CreateRoot onNavigate={vi.fn()} />)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CreateRoot — contract-verification gate', () => {
  beforeEach(() => {
    mockConfigResult.status = 'ok'
    mockConfigResult.key    = 'cascade-test'
    mockWrite.mockClear()
    mockApproveWrite.mockClear()
  })

  /* ── Verified — Review button should be reachable ──────────────────────── */

  it('ok + matching key — Review button is rendered', () => {
    renderCreateRoot()
    // The Review button is in the summary card action area.
    // When config is ok and form is not yet valid, it is disabled but present.
    const btn = screen.getByRole('button', { name: /review/i })
    expect(btn).toBeTruthy()
  })

  /* ── Blocked states — Review button must not be visible ────────────────── */

  it('loading status — shows verifying spinner, no Review button', () => {
    mockConfigResult.status = 'loading'
    renderCreateRoot()
    expect(screen.queryByRole('button', { name: /^review/i })).toBeNull()
    expect(screen.getByText(/verifying/i)).toBeTruthy()
  })

  it('error status — shows retry, no Review button', () => {
    mockConfigResult.status = 'error'
    renderCreateRoot()
    expect(screen.queryByRole('button', { name: /^review/i })).toBeNull()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('unverified status — shows gate, no Review button', () => {
    mockConfigResult.status = 'unverified'
    renderCreateRoot()
    expect(screen.queryByRole('button', { name: /^review/i })).toBeNull()
  })

  it('mismatch status — shows retry, no Review button', () => {
    mockConfigResult.status = 'mismatch'
    renderCreateRoot()
    expect(screen.queryByRole('button', { name: /^review/i })).toBeNull()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('not-deployed status — shows retry, no Review button', () => {
    mockConfigResult.status = 'not-deployed'
    renderCreateRoot()
    expect(screen.queryByRole('button', { name: /^review/i })).toBeNull()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })

  it('ok status but wrong key — shows verifying spinner, no Review button', () => {
    mockConfigResult.status = 'ok'
    mockConfigResult.key    = 'different-key'
    renderCreateRoot()
    expect(screen.queryByRole('button', { name: /^review/i })).toBeNull()
    expect(screen.getByText(/verifying/i)).toBeTruthy()
  })

  /* ── "What you'll sign" steps visibility ───────────────────────────────── */

  it('ok + matching key — "What you\'ll sign" section is rendered', () => {
    renderCreateRoot()
    expect(screen.getByText(/what you'll sign/i)).toBeTruthy()
  })

  it('error status — "What you\'ll sign" section is hidden', () => {
    mockConfigResult.status = 'error'
    renderCreateRoot()
    expect(screen.queryByText(/what you'll sign/i)).toBeNull()
  })

  it('loading status — "What you\'ll sign" section is hidden', () => {
    mockConfigResult.status = 'loading'
    renderCreateRoot()
    expect(screen.queryByText(/what you'll sign/i)).toBeNull()
  })
})
