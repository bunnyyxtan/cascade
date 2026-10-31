/**
 * Docs registry — single source of truth for all docs pages.
 * Sidebar structure, prev/next order, and search index all derive from this file.
 * headings are populated lazily from the rendered markdown.
 */
import type { Heading } from './mdRenderer'

export interface DocEntry {
  slug:        string
  title:       string
  description: string
  section:     string
  headings:    Heading[]
}

/** Ordered list — this is the prev/next and sidebar order. */
export const DOCS_ENTRIES: Omit<DocEntry, 'headings'>[] = [
  // ── Start ─────────────────────────────────────────────────────────────
  {
    slug:        'overview',
    title:       'Overview',
    description: "What Cascade does, the tree model, roles, and what V1 is and isn\u2019t.",
    section:     'Start',
  },
  {
    slug:        'quick-start',
    title:       'Quick start',
    description: 'Connect, create an objective, delegate, submit, approve and withdraw.',
    section:     'Start',
  },
  {
    slug:        'networks-and-addresses',
    title:       'Networks and addresses',
    description: 'Chain IDs, contract address, USDC, deploy block, and codehash.',
    section:     'Start',
  },

  // ── Core concepts ──────────────────────────────────────────────────────
  {
    slug:        'objectives-and-commitments',
    title:       'Objectives and commitments',
    description: 'Root vs child, depth ≤ 8, ≤ 16 children, and deadline rules.',
    section:     'Core concepts',
  },
  {
    slug:        'delegation-and-reserve',
    title:       'Delegation and reserve',
    description: 'The delegation limit, the protected reserve, freed capacity, and root-only rule.',
    section:     'Core concepts',
  },
  {
    slug:        'states-and-permissions',
    title:       'States and permissions',
    description: 'State diagram and full permission table for each action.',
    section:     'Core concepts',
  },
  {
    slug:        'money-flow-and-reconciliation',
    title:       'Money flow and reconciliation',
    description: 'The three balances, invariants, and where funds go on each outcome.',
    section:     'Core concepts',
  },

  // ── Using Cascade ──────────────────────────────────────────────────────
  {
    slug:        'creating-an-objective',
    title:       'Creating an objective',
    description: 'The approve-then-create flow, fields and validation.',
    section:     'Using Cascade',
  },
  {
    slug:        'delegating-work',
    title:       'Delegating work',
    description: 'Creating child commitments and allocating budget.',
    section:     'Using Cascade',
  },
  {
    slug:        'submitting-and-reviewing',
    title:       'Submitting and reviewing',
    description: 'deliveryRef, approve, and reject.',
    section:     'Using Cascade',
  },
  {
    slug:        'cancelling-and-expiry',
    title:       'Cancelling and expiry',
    description: 'Approver-initiated cancel and permissionless expiry.',
    section:     'Using Cascade',
  },
  {
    slug:        'claiming-usdc',
    title:       'Claiming USDC',
    description: 'Pull-based claim and the receipt.',
    section:     'Using Cascade',
  },
  {
    slug:        'troubleshooting',
    title:       'Troubleshooting',
    description: 'Wrong network, contract verification, rejected vs reverted, and syncing.',
    section:     'Using Cascade',
  },

  // ── Trust ─────────────────────────────────────────────────────────────
  {
    slug:        'verifying-cascade',
    title:       'Verifying Cascade',
    description: 'Reproduce the codehash, read events on the explorer.',
    section:     'Trust',
  },
  {
    slug:        'limitations',
    title:       'Limitations',
    description: 'No owner, audit, partial release, role reassignment, or automatic expiry.',
    section:     'Trust',
  },

  // ── For developers ────────────────────────────────────────────────────
  {
    slug:        'contracts',
    title:       'Contract reference',
    description: 'Full function signatures, events, errors, and financial invariants.',
    section:     'For developers',
  },
  {
    slug:        'security',
    title:       'Security model',
    description: 'Trust assumptions, role honesty, and known limitations from the source.',
    section:     'For developers',
  },
  {
    slug:        'architecture',
    title:       'Architecture',
    description: 'System architecture and component overview.',
    section:     'For developers',
  },
  {
    slug:        'deployment',
    title:       'Deployment',
    description: 'Reproducible build and deployment instructions.',
    section:     'For developers',
  },
  {
    slug:        'development',
    title:       'Development',
    description: 'Local development setup, testing, and build commands.',
    section:     'For developers',
  },
]

/** Legal pages — separate from the docs sidebar. */
export const LEGAL_ENTRIES = [
  { slug: 'usage-risks', title: 'Usage & Risks', path: '/usage-risks' },
] as const

/** All published content routes, for link checking and sitemap. */
export const CONTENT_PATHS = [
  '/docs',
  ...DOCS_ENTRIES.map(e => `/docs/${e.slug}`),
  '/security',
  '/faq',
  '/support',
  '/usage-risks',
]
