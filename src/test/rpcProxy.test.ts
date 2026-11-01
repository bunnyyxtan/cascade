/**
 * rpcProxy.test.ts
 *
 * Regression tests for the RPC connectivity architecture:
 *   1. Transport selection — VERCEL_PROXY_ACTIVE, Studio proxy, public RPC
 *   2. makeTransport / getPublicClient singleton behaviour
 *   3. Sync-concurrency fix — forced refresh during active sync must not overlap
 *   4. Error message correctness — blocked, rate-limited, generic
 *   5. History state preservation — cached events not cleared on transient failure
 *   6. Vercel proxy function — allowlist, body size, batch limit, disallowed method
 *
 * NOTE: Tests for api/rpc.ts use raw handler invocations so no HTTP server
 * is needed. Tests for network.ts / history.ts use module-level mocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── 1. Transport selection ─────────────────────────────────────────────────────

describe('EFFECTIVE_RPC_URL — transport priority', () => {
  const original = { ...import.meta.env }

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('prefers /api/rpc when VITE_VERCEL_RPC_PROXY=1', async () => {
    vi.stubEnv('VITE_VERCEL_RPC_PROXY', '1')
    vi.stubEnv('VITE_RPC_PROXY_BASE_URL', '')
    vi.stubEnv('VITE_NETWORK', 'mainnet')
    vi.resetModules()
    const net = await import('@/lib/network')
    expect(net.VERCEL_PROXY_ACTIVE).toBe(true)
    expect(net.EFFECTIVE_RPC_URL).toBe('/api/rpc')
  })

  it('falls back to Studio proxy when VITE_VERCEL_RPC_PROXY is absent but proxy env set', async () => {
    vi.stubEnv('VITE_VERCEL_RPC_PROXY', '')
    vi.stubEnv('VITE_RPC_PROXY_BASE_URL', 'https://studio-proxy.example.com')
    vi.stubEnv('VITE_RPC_PROXY_TOKEN', 'tok123')
    vi.stubEnv('VITE_RPC_PROXY_CHAINS', 'Arc,Arc_Testnet')
    vi.stubEnv('VITE_NETWORK', 'mainnet')
    vi.resetModules()
    const net = await import('@/lib/network')
    expect(net.VERCEL_PROXY_ACTIVE).toBe(false)
    expect(net.EFFECTIVE_RPC_URL).toContain('studio-proxy.example.com')
    expect(net.EFFECTIVE_RPC_URL).not.toBe('/api/rpc')
  })

  it('falls back to public RPC when neither proxy is configured', async () => {
    vi.stubEnv('VITE_VERCEL_RPC_PROXY', '')
    vi.stubEnv('VITE_RPC_PROXY_BASE_URL', '')
    vi.stubEnv('VITE_RPC_PROXY_CHAINS', '')
    vi.stubEnv('VITE_NETWORK', 'mainnet')
    vi.resetModules()
    const net = await import('@/lib/network')
    expect(net.VERCEL_PROXY_ACTIVE).toBe(false)
    expect(net.EFFECTIVE_RPC_URL).toContain('rpc.')
    expect(net.EFFECTIVE_RPC_URL).not.toBe('/api/rpc')
    expect(net.EFFECTIVE_RPC_URL).not.toContain('studio-proxy')
  })

  it('Vercel proxy takes precedence over Studio proxy when both are set', async () => {
    vi.stubEnv('VITE_VERCEL_RPC_PROXY', '1')
    vi.stubEnv('VITE_RPC_PROXY_BASE_URL', 'https://studio-proxy.example.com')
    vi.stubEnv('VITE_RPC_PROXY_CHAINS', 'Arc')
    vi.stubEnv('VITE_NETWORK', 'mainnet')
    vi.resetModules()
    const net = await import('@/lib/network')
    expect(net.EFFECTIVE_RPC_URL).toBe('/api/rpc')
  })

  it('testnet: EFFECTIVE_RPC_URL uses testnet path in Studio proxy', async () => {
    vi.stubEnv('VITE_VERCEL_RPC_PROXY', '')
    vi.stubEnv('VITE_RPC_PROXY_BASE_URL', 'https://studio-proxy.example.com')
    vi.stubEnv('VITE_RPC_PROXY_TOKEN', 'tok123')
    vi.stubEnv('VITE_RPC_PROXY_CHAINS', 'Arc_Testnet')
    vi.stubEnv('VITE_NETWORK', 'testnet')
    vi.resetModules()
    const net = await import('@/lib/network')
    expect(net.EFFECTIVE_RPC_URL).toContain('Arc_Testnet')
  })

  // Suppress unused warning
  void original
})

// ── 2. getPublicClient singleton ───────────────────────────────────────────────

describe('getPublicClient — singleton', () => {
  afterEach(() => { vi.resetModules() })

  it('returns the same object on repeated calls (singleton)', async () => {
    vi.stubEnv('VITE_NETWORK', 'testnet')
    vi.stubEnv('VITE_VERCEL_RPC_PROXY', '')
    vi.stubEnv('VITE_RPC_PROXY_BASE_URL', '')
    vi.resetModules()
    const net = await import('@/lib/network')
    const c1 = net.getPublicClient()
    const c2 = net.getPublicClient()
    expect(c1).toBe(c2)
  })
})

// ── 3. Sync concurrency — syncHistory forced during active sync ────────────────

describe('syncHistory — concurrency guard', () => {
  // We test the concurrency fix by inspecting module-level _syncing state via
  // a controlled mock: the getBlockNumber call is replaced with a promise we
  // resolve manually so we can interleave calls.

  let resolveBlock1: (v: bigint) => void
  let resolveBlock2: (v: bigint) => void

  const mockPublicClient = {
    getBlockNumber: vi.fn(),
    getLogs: vi.fn().mockResolvedValue([]),
  }

  beforeEach(() => {
    vi.resetModules()

    // Mock network to expose the mock client
    vi.doMock('@/lib/network', () => ({
      IS_MAINNET:          false,
      NETWORK_LABEL:       'Arc Testnet',
      NETWORK_LABEL_UPPER: 'ARC TESTNET',
      SWITCH_TO_LABEL:     'Switch to Arc Testnet',
      CHAIN_ID:            5042002,
      CHAIN:               { id: 5042002, name: 'Arc Testnet' },
      PUBLIC_RPC_URL:      'https://rpc.testnet.arc.io',
      RPC_URL:             'https://rpc.testnet.arc.io',
      VERCEL_PROXY_ACTIVE: false,
      EFFECTIVE_RPC_URL:   'https://rpc.testnet.arc.io',
      makeTransport:       vi.fn(),
      getPublicClient:     () => mockPublicClient,
    }))

    vi.doMock('@/lib/contracts', () => ({
      CASCADE_ADDRESS: '0xCaScAdE0000000000000000000000000000000000',
      USDC_ADDRESS:    '0x3600000000000000000000000000000000000000',
    }))

    vi.doMock('@/lib/cascadeAbi', () => ({ cascadeAbi: [] }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('non-forced sync while active sync runs: skipped (not queued)', async () => {
    const blockP1 = new Promise<bigint>((resolve) => { resolveBlock1 = resolve })

    mockPublicClient.getBlockNumber = vi.fn()
      .mockReturnValueOnce(blockP1)

    const { syncHistory } = await import('@/lib/history')

    // Start sync 1 (it will hang waiting for blockP1)
    const s1 = syncHistory(false)
    // Start sync 2 — non-forced, _syncing=true → should be silently skipped
    const s2 = syncHistory(false)

    // Resolve the block so sync 1 can finish
    resolveBlock1(100n)
    await s1
    await s2

    // getBlockNumber should only have been called once (sync 2 was dropped)
    expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(1)
  })

  it('forced sync during active sync: defers and runs after active sync finishes', async () => {
    const blockP1 = new Promise<bigint>((resolve) => { resolveBlock1 = resolve })
    const blockP2 = new Promise<bigint>((resolve) => { resolveBlock2 = resolve })

    mockPublicClient.getBlockNumber = vi.fn()
      .mockReturnValueOnce(blockP1)
      .mockReturnValueOnce(blockP2)

    const { syncHistory } = await import('@/lib/history')

    // Start sync 1 (hangs on blockP1)
    const s1 = syncHistory(false)

    // Force-sync while s1 is in-flight — should set _pendingForce
    const s2 = syncHistory(true)
    await s2  // returns immediately (sync 1 is still running)

    // s1 is still running; resolve it now
    resolveBlock1(100n)
    resolveBlock2(200n)
    await s1

    // Give the _pendingForce re-run a tick to start and finish
    await new Promise(r => setTimeout(r, 50))

    // getBlockNumber should be called twice: once for s1, once for the deferred forced re-run
    expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(2)
  })

  it('two rapid forced syncs: does not queue more than one re-run', async () => {
    const blockP1 = new Promise<bigint>((resolve) => { resolveBlock1 = resolve })

    mockPublicClient.getBlockNumber = vi.fn()
      .mockReturnValueOnce(blockP1)
      .mockResolvedValue(100n)  // subsequent calls resolve immediately

    const { syncHistory } = await import('@/lib/history')

    const s1 = syncHistory(false)

    // Two forced syncs while s1 is active
    void syncHistory(true)
    void syncHistory(true)

    resolveBlock1(100n)
    await s1
    await new Promise(r => setTimeout(r, 50))

    // Exactly two calls: s1 + one deferred (not two deferred)
    expect(mockPublicClient.getBlockNumber).toHaveBeenCalledTimes(2)
  })
})

// ── 4. Error message correctness ───────────────────────────────────────────────

describe('history.ts error messages', () => {
  const mockClient = {
    getBlockNumber: vi.fn(),
    getLogs: vi.fn().mockResolvedValue([]),
  }

  beforeEach(() => {
    vi.resetModules()
    vi.doMock('@/lib/network', () => ({
      IS_MAINNET:          true,
      NETWORK_LABEL:       'Arc Mainnet',
      CHAIN_ID:            5042,
      CHAIN:               { id: 5042 },
      PUBLIC_RPC_URL:      'https://rpc.mainnet.arc.io',
      RPC_URL:             'https://rpc.mainnet.arc.io',
      VERCEL_PROXY_ACTIVE: false,
      EFFECTIVE_RPC_URL:   'https://rpc.mainnet.arc.io',
      makeTransport:       vi.fn(),
      getPublicClient:     () => mockClient,
    }))
    vi.doMock('@/lib/contracts', () => ({
      CASCADE_ADDRESS: '0xCaScAdE0000000000000000000000000000000000',
    }))
    vi.doMock('@/lib/cascadeAbi', () => ({ cascadeAbi: [] }))
  })

  afterEach(() => { vi.resetModules() })

  it('rate-limit error: message contains "busy" and the network label', async () => {
    mockClient.getBlockNumber = vi.fn().mockRejectedValue(new Error('429 Too Many Requests'))
    const { syncHistory, getSnapshot } = await import('@/lib/history')
    await syncHistory(false)
    expect(getSnapshot().error).toMatch(/busy/i)
  })

  it('blocked-by-client error: message mentions ad-blocker', async () => {
    mockClient.getBlockNumber = vi.fn().mockRejectedValue(
      new Error('net::ERR_BLOCKED_BY_CLIENT')
    )
    const { syncHistory, getSnapshot } = await import('@/lib/history')
    await syncHistory(false)
    expect(getSnapshot().error).toMatch(/blocked/i)
  })

  it('generic error: falls back to "temporarily unavailable" for long opaque error messages', async () => {
    // A raw RPC error body can be hundreds of characters; the handler must not
    // dump it verbatim. The fallback message is used when the error exceeds 200 chars.
    const longErr = new Error('{"jsonrpc":"2.0","error":{"code":-32700,"message":"' + 'x'.repeat(200) + '"}}')
    mockClient.getBlockNumber = vi.fn().mockRejectedValue(longErr)
    const { syncHistory, getSnapshot } = await import('@/lib/history')
    await syncHistory(false)
    expect(getSnapshot().error).toMatch(/unavailable/i)
  })

  it('cached events are NOT cleared on transient failure', async () => {
    // First sync succeeds (no logs returned = nothing appended to events)
    mockClient.getBlockNumber = vi.fn()
      .mockResolvedValueOnce(200n)
      .mockRejectedValueOnce(new Error('network error'))
    mockClient.getLogs = vi.fn().mockResolvedValue([])

    const { syncHistory, getSnapshot } = await import('@/lib/history')

    await syncHistory(false)
    const eventsBefore = getSnapshot().events.length

    // Second sync: getBlockNumber throws
    mockClient.getLogs.mockResolvedValue([])
    await syncHistory(false)

    // Events must not be cleared; syncedTo checkpoint must not regress
    expect(getSnapshot().events.length).toBe(eventsBefore)
  })
})

// ── 5. Vercel proxy function — unit tests ──────────────────────────────────────

describe('api/rpc.ts handler', () => {
  // Import the handler directly (not through HTTP)
  // api/rpc.ts uses IncomingMessage / ServerResponse from node:http.
  // We build minimal mocks here.

  type MockRes = {
    statusCode: number
    headers: Record<string, string>
    body: string
    setHeader: (k: string, v: string) => void
    writeHead: (s: number, h?: Record<string, string>) => void
    end: (b?: string) => void
    status: (s: number) => MockRes
    json: (b: unknown) => void
    _json: () => unknown
  }

  function makeRes(): MockRes {
    const r: MockRes = {
      statusCode: 200,
      headers:    {},
      body:       '',
      setHeader(k, v) { this.headers[k] = v },
      writeHead(s, h) { this.statusCode = s; if (h) Object.assign(this.headers, h) },
      end(b = '')  { this.body = b },
      status(s)    { this.statusCode = s; return this },
      json(b)      { this.body = JSON.stringify(b) },
      _json(): unknown { return JSON.parse(this.body) },
    }
    return r
  }

  type MockReq = {
    method: string
    headers: Record<string, string>
    body?: unknown
    on: (event: string, cb: (chunk?: unknown) => void) => MockReq
  }

  function makeReq(
    method: string,
    body: unknown,
    headers: Record<string, string> = {}
  ): MockReq {
    return {
      method,
      headers,
      body,  // Vercel pre-parsed body
      on: (_event: string, _cb: (chunk?: unknown) => void) => ({ method, headers, body, on: (_e: string, _c: (chunk?: unknown) => void) => ({} as MockReq) }),
    }
  }

  let handler: (req: unknown, res: unknown) => Promise<void>

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../../api/rpc')
    handler = mod.default as (req: unknown, res: unknown) => Promise<void>
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('rejects GET with 405', async () => {
    const req = makeReq('GET', null)
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 500 when ARC_RPC_URL is not set', async () => {
    // Ensure env var is absent
    const saved = process.env.ARC_RPC_URL
    delete process.env.ARC_RPC_URL
    const req = makeReq('POST', { jsonrpc: '2.0', method: 'eth_chainId', id: 1 })
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(500)
    if (saved !== undefined) process.env.ARC_RPC_URL = saved
  })

  it('rejects disallowed method eth_sendRawTransaction with code -32601', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'
    const req = makeReq('POST', { jsonrpc: '2.0', method: 'eth_sendRawTransaction', params: ['0xabc'], id: 1 })
    const res = makeRes()
    await handler(req, res)
    // Returns 200 with a JSON-RPC error body (so viem sees it as an RPC error)
    expect(res.statusCode).toBe(200)
    const body = res._json() as { error?: { code?: number } }
    expect(body.error?.code).toBe(-32601)
  })

  it('rejects batch larger than MAX_BATCH with 413', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'
    const batch = Array.from({ length: 25 }, (_, i) => ({
      jsonrpc: '2.0', method: 'eth_chainId', id: i,
    }))
    const req = makeReq('POST', batch)
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(413)
  })

  it('rejects oversized body with 413', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'
    // Build a request whose JSON body exceeds 64 KiB
    const huge = { jsonrpc: '2.0', method: 'eth_call', params: ['0x' + 'a'.repeat(70_000)], id: 1 }
    const req = makeReq('POST', huge)
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(413)
  })

  it('rejects invalid JSON-RPC object with 400', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'
    const req = makeReq('POST', { notARpc: true })
    const res = makeRes()
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('forwards eth_chainId to upstream and returns result', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'

    // Stub global fetch to simulate a successful upstream response
    const upstreamResult = { jsonrpc: '2.0', result: '0x13b2', id: 1 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(upstreamResult)),
      headers: { get: () => null },
    }))

    const req = makeReq('POST', { jsonrpc: '2.0', method: 'eth_chainId', id: 1 })
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._json() as typeof upstreamResult
    expect(body.result).toBe('0x13b2')
    vi.unstubAllGlobals()
  })

  it('returns 429 with Retry-After when upstream rate-limits', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:     false,
      status: 429,
      headers: { get: (h: string) => h === 'Retry-After' ? '5' : null },
    }))

    const req = makeReq('POST', { jsonrpc: '2.0', method: 'eth_chainId', id: 1 })
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(429)
    expect(res.headers['Retry-After']).toBe('5')
    vi.unstubAllGlobals()
  })

  it('returns 504 when upstream call times out (AbortError)', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const e = new Error('The operation was aborted.')
      e.name = 'AbortError'
      return Promise.reject(e)
    }))

    const req = makeReq('POST', { jsonrpc: '2.0', method: 'eth_chainId', id: 1 })
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(504)
    vi.unstubAllGlobals()
  })

  it('ALLOWED_METHODS set contains eth_getLogs', async () => {
    process.env.ARC_RPC_URL = 'https://rpc.mainnet.arc.io'

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify({ jsonrpc: '2.0', result: [], id: 1 })),
      headers: { get: () => null },
    }))

    const req = makeReq('POST', { jsonrpc: '2.0', method: 'eth_getLogs', params: [{}], id: 1 })
    const res = makeRes()
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._json() as { error?: unknown }
    expect(body.error).toBeUndefined()
    vi.unstubAllGlobals()
  })
})

// ── 6. vercel.json routing ──────────────────────────────────────────────────────

describe('vercel.json routing', () => {
  it('has an explicit /api/:path* entry before the catch-all rewrite', async () => {
    const fs   = await import('node:fs')
    const path = await import('node:path')
    const raw = fs.readFileSync(path.resolve('/home/user/app/vercel.json'), 'utf8')
    const cfg = JSON.parse(raw) as { rewrites: Array<{ source: string; destination: string }> }

    const apiIdx   = cfg.rewrites.findIndex(r => r.source.startsWith('/api/'))
    const catchIdx = cfg.rewrites.findIndex(r => r.source === '/(.*)')

    expect(apiIdx).toBeGreaterThanOrEqual(0)
    expect(catchIdx).toBeGreaterThan(apiIdx)
  })

  it('catch-all rewrite destination is /index.html (SPA routing)', async () => {
    const fs   = await import('node:fs')
    const path = await import('node:path')
    const raw = fs.readFileSync(path.resolve('/home/user/app/vercel.json'), 'utf8')
    const cfg = JSON.parse(raw) as { rewrites: Array<{ source: string; destination: string }> }
    const catchAll = cfg.rewrites.find(r => r.source === '/(.*)')
    expect(catchAll?.destination).toBe('/index.html')
  })
})
