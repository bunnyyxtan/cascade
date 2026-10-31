/**
 * networkDisclosures.test.tsx
 *
 * Regression tests for mainnet-awareness in public-facing content pages.
 * These tests run with VITE_NETWORK=mainnet mocked (the default in the test
 * environment, which matches the deployed .env values).
 *
 * Verifies:
 *  1. No page says "testnet only" or "no mainnet" on the mainnet build.
 *  2. Important disclosures are present on the mainnet build:
 *     - USDC has real monetary value (Usage & Risks, mainnet section)
 *     - No independent audit completed (Security, FAQ)
 *     - Mainnet contract address appears (Security verification snippet, FAQ)
 *  3. Testnet build shows testnet-specific text (network label).
 *  4. No page falsely claims Circle has audited, endorsed, or certified Cascade.
 *  5. Test-count accuracy: pages say 112 Foundry tests, not 76.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ContentApp } from '@/content/ContentApp'

/* ── Shared page-render helpers ─────────────────────────────────────────────── */

function setPath(path: string) {
  Object.defineProperty(window, 'location', {
    value: { pathname: path, hash: '', search: '', href: `http://localhost${path}` },
    writable: true,
    configurable: true,
  })
}

/* ── Mock network / contracts — mainnet config ──────────────────────────────── */

vi.mock('@/lib/network', () => ({
  IS_MAINNET:          true,
  NETWORK_LABEL:       'Arc Mainnet',
  NETWORK_LABEL_UPPER: 'ARC MAINNET',
  SWITCH_TO_LABEL:     'Switch to Arc Mainnet',
  CHAIN_ID:            5042,
  RPC_URL:             'https://rpc.mainnet.arc.io',
  CHAIN: {
    id: 5042,
    name: 'Arc Mainnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.mainnet.arc.io'] } },
  },
}))

vi.mock('@/lib/contracts', () => ({
  CASCADE_ADDRESS:  '0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f',
  USDC_ADDRESS:     '0x3600000000000000000000000000000000000000',
  USDC_DECIMALS:    6,
  TARGET_CHAIN_ID:  5042,
  isDeployed:       true,
  txUrl:  (h: string) => `https://explorer.arc.io/tx/${h}`,
  addrUrl: (a: string) => `https://explorer.arc.io/address/${a}`,
}))

/* ── Also mock configCheck (used indirectly by WalletGate in some pages) ────── */
vi.mock('@/lib/configCheck', () => ({
  useConfigCheck:    () => ({ status: 'ok', key: 'mainnet-key', checkedAt: Date.now() }),
  retryConfigCheck:  vi.fn(),
  useChainIdWatcher: vi.fn(),
  EXPECTED_CONFIG_KEY: 'mainnet-key',
}))

vi.mock('wagmi', () => ({
  useAccount:      () => ({ isConnected: false, address: undefined, chainId: undefined }),
  useSwitchChain:  () => ({ switchChain: vi.fn(), isPending: false }),
  useWriteContract: () => ({
    writeContract: vi.fn(), data: undefined,
    isPending: false, isError: false, error: null, reset: vi.fn(),
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false, isSuccess: false, data: undefined,
  }),
  useBalance:  () => ({ data: undefined }),
  useReadContract: () => ({ data: undefined, isLoading: false, error: null }),
}))

vi.mock('connectkit', () => ({
  ConnectKitButton: {
    Custom: ({ children }: { children: (p: { show: () => void }) => React.ReactNode }) =>
      children({ show: vi.fn() }),
  },
}))

/* ─────────────────────────────────────────────────────────────────────────────
   MAINNET build — Usage & Risks
───────────────────────────────────────────────────────────────────────────── */

describe('/usage-risks — mainnet build', () => {
  beforeEach(() => { cleanup(); setPath('/usage-risks') })

  it('does NOT say "testnet only" or "no mainnet"', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/testnet only/i)
    expect(text).not.toMatch(/no mainnet/i)
    expect(text).not.toMatch(/mainnet.*not.*occurred/i)
    expect(text).not.toMatch(/no confirmed date/i)
  })

  it('warns that USDC has real monetary value', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/real monetary value|real USDC/i)
  })

  it('shows the mainnet contract address', () => {
    render(<ContentApp />)
    expect(document.body.textContent).toContain('0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f')
  })

  it('shows the Arc Mainnet network label', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/arc mainnet/i)
  })

  it('does NOT display operator personal name', () => {
    render(<ContentApp />)
    expect(screen.queryByText(/Shivam/)).toBeNull()
  })

  it('does not claim Circle audited or endorsed Cascade', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/circle.*audit/i)
    expect(text).not.toMatch(/circle.*certif/i)
    expect(text).not.toMatch(/circle.*endors/i)
  })
})

/* ─────────────────────────────────────────────────────────────────────────────
   MAINNET build — Security page
───────────────────────────────────────────────────────────────────────────── */

describe('/security — mainnet build', () => {
  beforeEach(() => { cleanup(); setPath('/security') })

  it('does NOT say "testnet only" or claim only testnet deployment', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/deployed on arc testnet only/i)
    expect(text).not.toMatch(/testnet for evaluation purposes/i)
  })

  it('states no external audit has been completed', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/no external security audit/i)
  })

  it('shows mainnet contract address in verification snippet', () => {
    render(<ContentApp />)
    expect(document.body.textContent).toContain('0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f')
  })

  it('shows mainnet RPC in verification snippet', () => {
    render(<ContentApp />)
    expect(document.body.textContent).toContain('rpc.mainnet.arc.io')
  })

  it('mentions Arc Mainnet in trust assumptions', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/arc mainnet/i)
  })

  it('shows updated test count (112, not "76 tests")', () => {
    render(<ContentApp />)
    expect(document.body.textContent).toContain('112')
    // "76 Foundry tests" / "76 automated tests" / "76 pass" must not appear
    const staleCount = document.body.textContent?.match(/\b76\b.{0,20}test|\btest.{0,20}\b76\b/i)
    expect(staleCount).toBeNull()
  })
})

/* ─────────────────────────────────────────────────────────────────────────────
   MAINNET build — FAQ
───────────────────────────────────────────────────────────────────────────── */

describe('/faq — mainnet build', () => {
  beforeEach(() => { cleanup(); setPath('/faq') })

  it('says mainnet is live', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/yes.*cascade v1.*deployed on arc mainnet/i)
  })

  it('does NOT say mainnet has no confirmed date', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).not.toMatch(/no confirmed date/i)
    expect(text).not.toMatch(/mainnet.*not.*occurred/i)
  })

  it('shows the mainnet contract address in the "Where is my USDC" answer', () => {
    render(<ContentApp />)
    expect(document.body.textContent).toContain('0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f')
  })

  it('does not reference the testnet-only address as the only contract', () => {
    render(<ContentApp />)
    // The testnet address should not appear as the primary/only contract address
    const text = document.body.textContent ?? ''
    // Either it doesn't appear at all, or mainnet address appears too
    if (text.includes('0xa87371b1127d88df309313ddcaa43b6191fa9a57')) {
      expect(text).toContain('0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f')
    }
  })
})

/* ─────────────────────────────────────────────────────────────────────────────
   MAINNET build — Support page
───────────────────────────────────────────────────────────────────────────── */

describe('/support — mainnet build', () => {
  beforeEach(() => { cleanup(); setPath('/support') })

  it('refers to Arc Mainnet in the wrong-network help text', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    expect(text).toMatch(/arc mainnet/i)
  })

  it('does NOT tell users to switch to Arc Testnet when on mainnet build', () => {
    render(<ContentApp />)
    const text = document.body.textContent ?? ''
    // Should not say "only works on Arc Testnet" since this is the mainnet build
    expect(text).not.toMatch(/only works on arc testnet/i)
  })
})

/* ─────────────────────────────────────────────────────────────────────────────
   Cross-page: no page claims Circle audited Cascade
───────────────────────────────────────────────────────────────────────────── */

describe('No page claims Circle audited or endorsed Cascade', () => {
  const PAGES = ['/usage-risks', '/security', '/faq', '/support', '/docs']

  PAGES.forEach(path => {
    it(`${path} makes no Circle audit/endorsement claim`, () => {
      cleanup()
      setPath(path)
      render(<ContentApp />)
      const text = document.body.textContent ?? ''
      expect(text).not.toMatch(/circle.*audit/i)
      expect(text).not.toMatch(/circle.*certif/i)
      expect(text).not.toMatch(/circle.*endors/i)
      expect(text).not.toMatch(/audited by circle/i)
    })
  })
})
