/**
 * api/rpc.ts — Vercel Serverless Function: restricted JSON-RPC proxy.
 *
 * Routes same-origin read-only JSON-RPC calls from the browser to the
 * configured Arc RPC provider. The upstream URL is never exposed to the
 * browser — it lives only in the Vercel project environment variables.
 *
 * Security properties:
 *   - Fixed upstream: destination is read from VITE_RPC_URL (server-side
 *     env var) and is never user-controlled.
 *   - Method allowlist: only read-only eth_* / net_* methods are permitted.
 *     Signing and submission methods are rejected — the wallet handles those
 *     directly to its own RPC endpoint.
 *   - Body size limit: 64 KiB. Oversized requests return 413.
 *   - Batch limit: at most 20 JSON-RPC objects per request.
 *   - Timeout: 10 s upstream call.
 *   - No secrets leaked: upstream errors are summarised, not forwarded.
 *
 * Required Vercel environment variable (server-side only — never VITE_-prefixed):
 *   ARC_RPC_URL — the Arc RPC endpoint (e.g. https://rpc.mainnet.arc.io)
 *
 * Optional:
 *   ARC_RPC_URL_TESTNET — testnet endpoint. When present and the request
 *     carries X-Arc-Network: testnet, this is used instead.
 *
 * Set in the same Vercel project to tell the frontend the proxy is active:
 *   VITE_VERCEL_RPC_PROXY=1   (browser-visible VITE_ prefix, value "1")
 */

import type { IncomingMessage, ServerResponse } from 'node:http'

// ── Constants ──────────────────────────────────────────────────────────────────

const MAX_BODY_BYTES       = 64 * 1024   // 64 KiB
const MAX_BATCH            = 20
const UPSTREAM_TIMEOUT_MS  = 10_000      // 10 s
const CONTENT_TYPE_JSON    = 'application/json'

/**
 * Read-only methods the frontend legitimately needs.
 * Transaction submission and signing are excluded — the wallet uses its own RPC.
 */
const ALLOWED_METHODS = new Set([
  'eth_chainId',
  'eth_blockNumber',
  'net_version',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_getBlockTransactionCountByNumber',
  'eth_getBlockTransactionCountByHash',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_getLogs',
  'eth_call',
  'eth_estimateGas',
  'eth_gasPrice',
  'eth_maxPriorityFeePerGas',
  'eth_feeHistory',
  'web3_clientVersion',
  'eth_protocolVersion',
])

// ── Types ──────────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: string
  method:  string
  params?: unknown
  id?:     number | string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isJsonRpcRequest(v: unknown): v is JsonRpcRequest {
  return (
    typeof v === 'object' && v !== null &&
    'method' in v &&
    typeof (v as Record<string, unknown>).method === 'string'
  )
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': CONTENT_TYPE_JSON })
  res.end(payload)
}

function rpcError(res: ServerResponse, status: number, message: string, id: unknown = null): void {
  sendJson(res, status, { jsonrpc: '2.0', error: { code: -32600, message }, id })
}

/** Read and size-check the request body. Returns null on oversized or unreadable bodies. */
async function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) { resolve(null); req.destroy() } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })
}

// ── Handler ────────────────────────────────────────────────────────────────────

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  // ── Resolve upstream URL ────────────────────────────────────────────────────
  const networkHeader = ((req.headers as Record<string, string | string[] | undefined>)['x-arc-network'] as string | undefined)?.toLowerCase()
  const upstreamUrl = (networkHeader === 'testnet' && process.env.ARC_RPC_URL_TESTNET)
    ? process.env.ARC_RPC_URL_TESTNET
    : process.env.ARC_RPC_URL

  if (!upstreamUrl) {
    rpcError(res, 500, 'RPC proxy not configured.')
    return
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  // Vercel may pre-parse the body as req.body (if bodyParser middleware runs),
  // or it may arrive as a stream. Handle both.
  let bodyStr: string
  const preBody = (req as unknown as Record<string, unknown>).body
  if (preBody !== undefined) {
    bodyStr = typeof preBody === 'string' ? preBody : JSON.stringify(preBody)
    if (Buffer.byteLength(bodyStr, 'utf8') > MAX_BODY_BYTES) {
      rpcError(res, 413, 'Request body exceeds limit.')
      return
    }
  } else {
    const raw = await readBody(req)
    if (raw === null) {
      rpcError(res, 413, 'Request body exceeds limit or could not be read.')
      return
    }
    bodyStr = raw
  }

  // ── Parse JSON ──────────────────────────────────────────────────────────────
  let body: unknown
  try { body = JSON.parse(bodyStr) } catch {
    rpcError(res, 400, 'Invalid JSON.')
    return
  }

  // ── Validate requests ───────────────────────────────────────────────────────
  const requests: JsonRpcRequest[] = []
  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) {
      rpcError(res, 413, `Batch exceeds limit of ${MAX_BATCH} requests.`)
      return
    }
    for (const item of body) {
      if (!isJsonRpcRequest(item)) { rpcError(res, 400, 'Invalid JSON-RPC request in batch.'); return }
      requests.push(item)
    }
  } else if (isJsonRpcRequest(body)) {
    requests.push(body)
  } else {
    rpcError(res, 400, 'Invalid JSON-RPC request.')
    return
  }

  // ── Method allowlist ────────────────────────────────────────────────────────
  for (const rpc of requests) {
    if (!ALLOWED_METHODS.has(rpc.method)) {
      sendJson(res, 200, {
        jsonrpc: '2.0',
        error: { code: -32601, message: `Method not permitted: ${rpc.method}` },
        id: rpc.id ?? null,
      })
      return
    }
  }

  // ── Forward to upstream ─────────────────────────────────────────────────────
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch(upstreamUrl, {
      method:  'POST',
      headers: { 'Content-Type': CONTENT_TYPE_JSON, 'Accept': CONTENT_TYPE_JSON },
      body:    bodyStr,
      signal:  controller.signal,
    })
    clearTimeout(timeoutId)

    if (!upstream.ok) {
      if (upstream.status === 429) {
        const retryAfter = upstream.headers.get('Retry-After')
        if (retryAfter) res.setHeader('Retry-After', retryAfter)
        rpcError(res, 429, 'RPC provider rate limit reached. Retry shortly.')
        return
      }
      rpcError(res, 502, `Upstream RPC error (${upstream.status}).`)
      return
    }

    const responseBody = await upstream.text()
    res.writeHead(200, { 'Content-Type': CONTENT_TYPE_JSON })
    res.end(responseBody)
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      rpcError(res, 504, 'RPC request timed out.')
      return
    }
    rpcError(res, 502, 'RPC proxy error.')
  }
}
