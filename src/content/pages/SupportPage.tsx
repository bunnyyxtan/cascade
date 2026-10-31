import { PageHead } from '../PageHead'
import { DocsLayout } from '../DocsLayout'
import { CONTACT_MAILTO, CONTACT_EMAIL } from '../site'
import { contentNavigate } from '@/router'
import type { DocEntry } from '../docsRegistry'

const LAST_UPDATED = '31 Oct 2026'

interface Props { docs: DocEntry[]; onHome: () => void }

export function SupportPage({ docs, onHome }: Props) {
  return (
    <>
      <PageHead
        title="Support — Cascade"
        description="Get help with Cascade: contact, self-help guides, and GitHub."
      />
      <DocsLayout slug="faq" title="Support" headings={[
        { id: 'contact',   level: 2, text: 'Contact' },
        { id: 'self-help', level: 2, text: 'Self-help' },
        { id: 'github',    level: 2, text: 'GitHub' },
      ]} docs={docs} onHome={onHome}>

        <h1 className="md-h1">Support</h1>
        <p className="docs-last-updated">Last updated: {LAST_UPDATED}</p>

        <h2 className="md-h2" id="contact">Contact</h2>
        <p className="md-p">
          For support questions and security reports, email{' '}
          <a href={CONTACT_MAILTO} className="md-link">{CONTACT_EMAIL}</a>.
        </p>
        <p className="md-p">
          When writing in, it helps to include:
        </p>
        <ul className="md-ul">
          <li className="md-li">Your wallet address (the one you used in Cascade)</li>
          <li className="md-li">The objective number (e.g. #7) or the commitment ID</li>
          <li className="md-li">The transaction hash, if the problem occurred during a transaction</li>
          <li className="md-li">The network (Arc Testnet, chain id 5042002)</li>
          <li className="md-li">A screenshot of any error message shown in the app or your wallet</li>
        </ul>
        <p className="md-p">
          There is no guaranteed response time.
        </p>

        <h2 className="md-h2" id="self-help">Self-help</h2>
        <p className="md-p">
          The{' '}
          <a href="/docs/troubleshooting" onClick={e => { e.preventDefault(); contentNavigate('/docs/troubleshooting') }} className="md-link">
            Troubleshooting
          </a>{' '}
          article covers the most common issues. Quick reference:
        </p>
        <ul className="md-ul">
          <li className="md-li">
            <strong>Wrong network.</strong> Cascade only works on Arc Testnet (chain id 5042002).
            If you see a "wrong network" banner, switch your wallet to Arc Testnet.
          </li>
          <li className="md-li">
            <strong>"Couldn't verify contract" or "Verifying contract…"</strong> The app checks
            the deployed contract's codehash at startup. If this message persists, the RPC may
            be slow or the contract address in the app's config may not match what's on chain.
            Try refreshing. If it continues, check the{' '}
            <a href="https://explorer.testnet.arc.io/address/0xa87371b1127d88df309313ddcaa43b6191fa9a57" target="_blank" rel="noreferrer" className="md-link">
              block explorer
            </a>.
          </li>
          <li className="md-li">
            <strong>Transaction rejected in wallet.</strong> A rejection in your wallet (error code
            4001) is not a contract error — you cancelled it. The app shows a neutral note, not a
            red error. Try again when you are ready.
          </li>
          <li className="md-li">
            <strong>History not showing.</strong> The app fetches events from the chain in
            batches. On first load or after a long gap, this can take a few seconds. Wait for
            the sync to finish (progress is shown in the Activity panel).
          </li>
          <li className="md-li">
            <strong>Allowance error or "insufficient allowance".</strong> Creating an objective
            requires approving the USDC amount before the <code className="md-inline-code">createRoot</code>{' '}
            call. The app does this in two steps. If the approval step failed or was for the wrong
            amount, the second step will fail. Try the full create flow again from the beginning.
          </li>
        </ul>

        <h2 className="md-h2" id="github">GitHub</h2>
        <p className="md-p">
          For bug reports and feature requests, open an issue on{' '}
          <a
            href="https://github.com/bunnyyxtan/cascade/issues"
            target="_blank"
            rel="noreferrer"
            className="md-link"
          >
            github.com/bunnyyxtan/cascade
          </a>.
          Security issues should be sent by email, not opened as public issues.
        </p>

      </DocsLayout>
    </>
  )
}
