import { PageHead } from '../PageHead'
import { DocsLayout } from '../DocsLayout'
import { CONTACT_MAILTO, CONTACT_EMAIL } from '../site'
import { contentNavigate } from '@/router'
import { IS_MAINNET, NETWORK_LABEL, CHAIN_ID, RPC_URL } from '@/lib/network'
import { CASCADE_ADDRESS } from '@/lib/contracts'
import type { DocEntry } from '../docsRegistry'

const LAST_UPDATED = '31 Oct 2026'

interface Props { docs: DocEntry[]; onHome: () => void }

export function SecurityPage({ docs, onHome }: Props) {
  return (
    <>
      <PageHead
        title="Security | Cascade"
        description="Security model, trust assumptions, verification, audit status, and how to report a vulnerability."
      />
      <DocsLayout slug="security" title="Security" headings={[
        { id: 'security-model',   level: 2, text: 'Security model' },
        { id: 'trust-assumptions', level: 2, text: 'Trust assumptions' },
        { id: 'known-risks',      level: 2, text: 'Known risks and limitations' },
        { id: 'verification',     level: 2, text: 'Verification' },
        { id: 'audit-status',     level: 2, text: 'Audit status' },
        { id: 'reporting',        level: 2, text: 'Reporting a vulnerability' },
      ]} docs={docs} onHome={onHome}>

        <h1 className="md-h1">Security</h1>
        <p className="docs-last-updated">Last updated: {LAST_UPDATED}</p>

        <h2 className="md-h2" id="security-model">Security model</h2>
        <p className="md-p">
          The Cascade contract is <strong>immutable</strong>: there is no admin key, no proxy, no
          pause function, and no upgrade path. Once deployed, its rules cannot change.
        </p>
        <p className="md-p">
          It is <strong>non-custodial</strong>: USDC is held by the contract, not by the operator or
          any privileged address. The operator has no special function in the contract and cannot
          move or recover funds.
        </p>
        <p className="md-p">
          Claims are <strong>pull-based</strong>: USDC is only transferred to a wallet when
          the manager or client explicitly calls <code className="md-inline-code">claim()</code>. Nothing is pushed automatically.
        </p>
        <p className="md-p">
          The contract uses OpenZeppelin's <code className="md-inline-code">ReentrancyGuard</code> on all state-changing
          functions, and <code className="md-inline-code">SafeERC20</code> for all token transfers. Native value sent to
          the contract is rejected.
        </p>
        <p className="md-p">
          Three financial invariants hold after every transaction:
        </p>
        <ul className="md-ul">
          <li className="md-li"><code className="md-inline-code">totalEscrowed == sum of all commitment.remaining</code></li>
          <li className="md-li"><code className="md-inline-code">totalClaimable == sum of all claimable[address]</code></li>
          <li className="md-li"><code className="md-inline-code">USDC.balanceOf(contract) &gt;= totalEscrowed + totalClaimable</code></li>
        </ul>

        <h2 className="md-h2" id="trust-assumptions">Trust assumptions</h2>
        <p className="md-p">
          Using Cascade requires trusting several things outside the contract itself:
        </p>
        <ul className="md-ul">
          <li className="md-li">
            <strong>The Arc network.</strong> Cascade relies on {NETWORK_LABEL} (chain id {CHAIN_ID}) for
            transaction ordering, finality, and state. A chain-level event (e.g. a reorg) could
            affect contract state.
          </li>
          <li className="md-li">
            <strong>The USDC contract.</strong> Cascade holds and transfers USDC at{' '}
            <code className="md-inline-code">0x3600000000000000000000000000000000000000</code>. Any
            vulnerability or behaviour change in that contract would affect Cascade.
          </li>
          <li className="md-li">
            <strong>The RPC endpoint.</strong> The application reads chain state and submits
            transactions through <code className="md-inline-code">{RPC_URL}</code>. A
            compromised or unavailable RPC could show you incorrect data, though the contract
            itself would remain unaffected.
          </li>
          <li className="md-li">
            <strong>Your browser wallet.</strong> Cascade asks your wallet to sign transactions.
            A compromised extension or phishing site could present different data for you to sign.
            Always check the transaction details in your wallet before confirming.
          </li>
          <li className="md-li">
            <strong>The people you appoint.</strong> The protocol enforces structural rules, not
            outcome honesty. An approver who colludes with a manager can approve fabricated work.
            Use Cascade with people you trust or have an off-chain agreement with.
          </li>
        </ul>

        <h2 className="md-h2" id="known-risks">Known risks and limitations</h2>
        <p className="md-p">
          See the{' '}
          <a href="/docs/limitations" onClick={e => { e.preventDefault(); contentNavigate('/docs/limitations') }} className="md-link">Limitations</a>{' '}
          article for the full list. Key points:
        </p>
        <ul className="md-ul">
          <li className="md-li">Expired commitments do not self-resolve. Someone must call <code className="md-inline-code">expire</code> after the deadline, with all children terminal.</li>
          <li className="md-li">Role assignments (manager, approver) are fixed at creation and cannot be changed.</li>
          <li className="md-li">There is no partial release. The full remaining balance is moved on approve.</li>
          <li className="md-li">Unsolicited USDC sent directly to the contract is unrecoverable — there is no sweep function.</li>
          <li className="md-li">RPC log-range limits may slow event fetching on long-lived chains.</li>
        </ul>

        <h2 className="md-h2" id="verification">Verification</h2>
        <p className="md-p">
          You can verify that the deployed contract matches the published source by reproducing
          the codehash:
        </p>
        <pre className="md-pre"><code>{`# ${IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet'}
RPC_URL=${RPC_URL}
ADDRESS=${CASCADE_ADDRESS || '<not-deployed>'}
EXPECTED=0xdae313ed3e636b9ee2cc0067af1a501ad8128e031a2d23b5f2d5e78ae1cd8e29

actual=$(cast keccak $(cast code "$ADDRESS" --rpc-url "$RPC_URL"))
echo "Expected: $EXPECTED"
echo "Actual:   $actual"
[ "$actual" = "$EXPECTED" ] && echo "match" || echo "MISMATCH"`}</code></pre>
        <p className="md-p">
          The build fingerprint (keccak of the init code) is{' '}
          <code className="md-inline-code">0x39c3876cf70236c25a3b9d35947506d5136198d7d99cdc77fbe11f6fa225c660</code>,
          produced with solc 0.8.28, Cancun EVM target, optimizer 200.
        </p>
        <p className="md-p">
          The application also verifies the codehash on startup. If the codehash does not match
          the expected value, all write operations are blocked and the UI shows an
          "Unverified contract" notice. This is a fail-closed check.
        </p>
        <p className="md-p">
          See the{' '}
          <a href="/docs/verifying-cascade" onClick={e => { e.preventDefault(); contentNavigate('/docs/verifying-cascade') }} className="md-link">Verifying Cascade</a>{' '}
          article for a step-by-step walkthrough.
        </p>

        <h2 className="md-h2" id="audit-status">Audit status</h2>
        <p className="md-p">
          <strong>No external security audit has been completed.</strong>
        </p>
        <p className="md-p">
          The contract has 112 Foundry tests: 60 unit tests, 10 fuzz tests, 6 invariant tests,
          and 26 adversarial tests (all pass). The source has not yet been submitted for
          block-explorer source verification on either network.
        </p>
        {IS_MAINNET ? (
          <p className="md-p">
            Cascade V1 is deployed on Arc Mainnet. No independent professional security audit has
            been completed. Use amounts proportionate to the risk of an unaudited contract.
          </p>
        ) : (
          <p className="md-p">
            Cascade V1 is deployed on Arc Testnet for evaluation. An independent audit has not
            been completed. Test USDC has no monetary value.
          </p>
        )}

        <h2 className="md-h2" id="reporting">Reporting a vulnerability</h2>
        <p className="md-p">
          If you find a security issue, email{' '}
          <a href={CONTACT_MAILTO} className="md-link">{CONTACT_EMAIL}</a>{' '}
          with <strong>Security</strong> in the subject line. Please include:
        </p>
        <ul className="md-ul">
          <li className="md-li">A description of the issue and its potential impact.</li>
          <li className="md-li">Steps to reproduce, including any relevant transaction hashes or contract state.</li>
          <li className="md-li">Your suggested severity (critical, high, medium, low).</li>
        </ul>
        <p className="md-p">
          Please do not disclose the vulnerability publicly before making contact and allowing
          reasonable time to respond. No bug bounty is offered at this time.
        </p>
        <p className="md-p">
          You can also open a{' '}
          <a
            href="https://github.com/bunnyyxtan/cascade/security/advisories/new"
            target="_blank"
            rel="noreferrer"
            className="md-link"
          >
            GitHub Security Advisory
          </a>{' '}
          as an alternative.
        </p>

      </DocsLayout>
    </>
  )
}
