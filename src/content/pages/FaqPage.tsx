import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHead } from '../PageHead'
import { DocsLayout } from '../DocsLayout'
import { contentNavigate } from '@/router'
import { IS_MAINNET, NETWORK_LABEL } from '@/lib/network'
import { CASCADE_ADDRESS } from '@/lib/contracts'
import type { DocEntry } from '../docsRegistry'

const LAST_UPDATED = '31 Oct 2026'

interface FaqItem {
  id:       string
  question: string
  answer:   React.ReactNode
}

interface FaqGroup {
  title: string
  items: FaqItem[]
}

function buildFaqGroups(networkLabel: string, isMainnet: boolean, cascadeAddress: string): FaqGroup[] {
  return [
  {
    title: 'Basics',
    items: [
      {
        id: 'what-is-cascade',
        question: 'What is Cascade?',
        answer: (
          <>
            <p>
              Cascade is a smart-contract protocol on {networkLabel} that lets a client fund an
              objective in USDC, appoint a manager, set a delegation limit, and then let the
              manager create child commitments for specialists — all enforced onchain with no
              admin key.
            </p>
            <p>
              See the{' '}
              <a href="/docs/overview" onClick={e => { e.preventDefault(); contentNavigate('/docs/overview') }}>
                Overview
              </a>{' '}
              article for the full picture.
            </p>
          </>
        ),
      },
      {
        id: 'is-mainnet-live',
        question: 'Is mainnet live?',
        answer: isMainnet ? (
          <p>
            Yes. Cascade V1 is deployed on Arc Mainnet (chain id 5042). USDC on Arc Mainnet
            has real monetary value. See{' '}
            <a href="/docs/networks-and-addresses" onClick={e => { e.preventDefault(); contentNavigate('/docs/networks-and-addresses') }}>
              Networks and addresses
            </a>{' '}
            for the contract address and verification details.
          </p>
        ) : (
          <p>
            Cascade V1 is deployed on both Arc Testnet (chain id 5042002) and Arc Mainnet
            (chain id 5042). This instance is connected to Arc Testnet. Test USDC has no
            monetary value. See{' '}
            <a href="/docs/networks-and-addresses" onClick={e => { e.preventDefault(); contentNavigate('/docs/networks-and-addresses') }}>
              Networks and addresses
            </a>.
          </p>
        ),
      },
      {
        id: 'two-signatures',
        question: 'Why do I need two signatures to create an objective?',
        answer: (
          <>
            <p>
              Creating a root objective requires an ERC-20 approval followed by the{' '}
              <code>createRoot</code> call. The approval authorises the contract to pull the
              exact USDC amount from your wallet. The{' '}
              <code>createRoot</code> call then does the actual transfer and locks the funds
              in escrow.
            </p>
            <p>
              This two-step pattern is standard for ERC-20 tokens. The app handles both steps
              and shows you a summary before each signature.
            </p>
          </>
        ),
      },
      {
        id: 'has-cascade-been-audited',
        question: 'Has Cascade been audited?',
        answer: (
          <>
            <p>
              No external security audit has been completed. The contract has 76 automated
              Foundry tests (60 unit, 10 fuzz, 6 invariant), but this does not replace an
              independent audit.
            </p>
            <p>
              See the{' '}
              <a href="/security" onClick={e => { e.preventDefault(); contentNavigate('/security') }}>
                Security
              </a>{' '}
              page for details.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Money',
    items: [
      {
        id: 'where-is-my-usdc',
        question: 'Where is my USDC while it is locked?',
        answer: (
          <>
            <p>
              USDC is held by the Cascade contract
              {cascadeAddress ? <> at{' '}<code>{cascadeAddress}</code></> : null}.
              {' '}Neither the operator nor any other address can move it. It can only be
              released through the contract's own rules — by approving a commitment or by a
              failure (rejection, cancellation, expiry) that returns it to the parent or client.
            </p>
            <p>
              See{' '}
              <a href="/docs/money-flow-and-reconciliation" onClick={e => { e.preventDefault(); contentNavigate('/docs/money-flow-and-reconciliation') }}>
                Money flow and reconciliation
              </a>.
            </p>
          </>
        ),
      },
      {
        id: 'is-delegation-a-transfer',
        question: 'Is creating a child commitment a USDC transfer?',
        answer: (
          <>
            <p>
              No. Delegation is internal accounting only. When a manager creates a child,
              no tokens move between wallets. The amount is subtracted from the parent's
              remaining balance and attributed to the child — all inside the contract.
              USDC only leaves the contract when a manager or client calls <code>claim</code>{' '}
              after an approval or failure resolution.
            </p>
            <p>
              See{' '}
              <a href="/docs/delegation-and-reserve" onClick={e => { e.preventDefault(); contentNavigate('/docs/delegation-and-reserve') }}>
                Delegation and reserve
              </a>.
            </p>
          </>
        ),
      },
      {
        id: 'money-back-rejected',
        question: 'Can I get money back from a rejected task?',
        answer: (
          <>
            <p>
              Yes. When a commitment is rejected, its remaining balance returns to the parent
              commitment's remaining balance. For a root commitment, rejection returns the
              remaining to the client's claimable balance, which the client can then claim.
            </p>
            <p>
              Already-settled payouts to child managers are never reversed. Only the unspent
              portion of the rejected commitment is returned.
            </p>
          </>
        ),
      },
    ],
  },
  {
    title: 'Permissions',
    items: [
      {
        id: 'who-can-expire',
        question: 'Who can expire a commitment?',
        answer: (
          <p>
            Anyone. <code>expire</code> is a permissionless function. Any address can call it
            once the commitment's deadline has passed and all of its direct children are in a
            terminal state (Succeeded or Failed). The contract does not expire commitments
            automatically — someone has to trigger it.
          </p>
        ),
      },
      {
        id: 'can-roles-change',
        question: 'Can manager or approver roles be changed after creation?',
        answer: (
          <p>
            No. Role assignments are fixed at the time the commitment is created and cannot
            be modified. If you appoint the wrong address, the only way to recover is to
            cancel the commitment (if the approver agrees) and create a new one.
          </p>
        ),
      },
      {
        id: 'who-approves-root',
        question: 'Who approves a root commitment?',
        answer: (
          <p>
            The client who created the root is also its approver. The client funds the
            objective and retains approval authority over the root manager's delivery.
            For child commitments, the approver is the parent commitment's manager.
          </p>
        ),
      },
    ],
  },
  {
    title: 'Safety',
    items: [
      {
        id: 'what-if-website-disappears',
        question: 'What if the Cascade website disappears?',
        answer: (
          <>
            <p>
              The contract is immutable and lives on the Arc blockchain independently of the
              website. If the website goes offline, you can still interact with the contract
              directly using any Ethereum-compatible tool (e.g. <code>cast</code> from Foundry
              or any wallet that supports custom contract calls).
            </p>
            <p>
              Existing commitments, balances, and claimable amounts are preserved in the
              contract regardless of website availability.
            </p>
          </>
        ),
      },
      {
        id: 'funds-stuck',
        question: 'Can funds get permanently stuck?',
        answer: (
          <>
            <p>
              In most cases, no. Failed children return their remaining balance to the parent,
              and a root can be cancelled by the approver or expired by anyone once the
              deadline passes and all children are terminal. The client can then claim the
              returned funds.
            </p>
            <p>
              However, if a commitment is still Active and neither expired nor cancelled, and
              no one calls <code>expire</code> after the deadline, funds remain locked
              in escrow. The deadline expiry path is permissionless, so anyone can trigger it.
            </p>
          </>
        ),
      },
      {
        id: 'sensitive-delivery-ref',
        question: 'Is my delivery reference private?',
        answer: (
          <p>
            No. The delivery reference is stored permanently as a public string on the
            blockchain. Anyone can read it. Use a content-addressed link (such as an IPFS CID)
            to reference the actual work, rather than embedding sensitive content directly
            in the reference string.
          </p>
        ),
      },
    ],
  },
  ]
}

interface AccordionItemProps { item: FaqItem }

function AccordionItem({ item }: AccordionItemProps) {
  const [open, setOpen] = useState(false)
  const answerId = `faq-answer-${item.id}`

  return (
    <div className="faq-item">
      <button
        className="faq-trigger"
        aria-expanded={open}
        aria-controls={answerId}
        onClick={() => setOpen(v => !v)}
      >
        {item.question}
        <span className="faq-trigger-icon" aria-hidden="true">
          <Plus size={12} strokeWidth={2.5} />
        </span>
      </button>
      <div
        id={answerId}
        className="faq-answer"
        role="region"
        aria-labelledby={`faq-trigger-${item.id}`}
        hidden={!open}
      >
        <div className="faq-answer-inner">
          {item.answer}
        </div>
      </div>
    </div>
  )
}

interface Props { docs: DocEntry[]; onHome: () => void }

export function FaqPage({ docs, onHome }: Props) {
  const FAQ_GROUPS = buildFaqGroups(NETWORK_LABEL, IS_MAINNET, CASCADE_ADDRESS)
  // Build TOC headings from groups
  const headings = FAQ_GROUPS.map(g => ({
    id:    g.title.toLowerCase().replace(/\s+/g, '-'),
    level: 2 as const,
    text:  g.title,
  }))

  return (
    <>
      <PageHead
        title="FAQ — Cascade"
        description="Frequently asked questions about Cascade: what it is, how the money works, permissions, and safety."
      />
      <DocsLayout slug="faq" title="FAQ" headings={headings} docs={docs} onHome={onHome}>

        <h1 className="md-h1">FAQ</h1>
        <p className="docs-last-updated">Last updated: {LAST_UPDATED}</p>
        <p className="md-p" style={{ marginBottom: 32 }}>
          Common questions about Cascade. Click a question to expand it.
        </p>

        {FAQ_GROUPS.map(group => (
          <section key={group.title} className="faq-group" aria-labelledby={`faq-group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <h2
              className="faq-group-title"
              id={`faq-group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {group.title}
            </h2>
            {group.items.map(item => (
              <AccordionItem key={item.id} item={item} />
            ))}
          </section>
        ))}

      </DocsLayout>
    </>
  )
}
