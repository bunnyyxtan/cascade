import { PageHead } from '../PageHead'
import { LegalLayout, LegalSection } from '../LegalLayout'
import { CONTACT_MAILTO, CONTACT_EMAIL } from '../site'
import { contentNavigate } from '@/router'
import { IS_MAINNET, NETWORK_LABEL } from '@/lib/network'
import { CASCADE_ADDRESS, addrUrl } from '@/lib/contracts'

const SECTIONS = [
  { id: 'who-runs-cascade',    title: 'Who runs Cascade' },
  { id: 'your-wallet',         title: 'You control your wallet' },
  { id: 'contract-holds-funds', title: 'The contract holds the funds' },
  { id: 'final-transactions',  title: 'Transactions are real and final' },
  { id: 'no-audit',            title: 'No external audit' },
  { id: 'no-guarantees',       title: 'No guarantees' },
  { id: 'public-data',         title: 'Public data' },
  { id: 'network',             title: 'Network' },
  { id: 'changes',             title: 'Changes to this page' },
]

export function UsageRisksPage({ onHome }: { onHome: () => void }) {
  const explorerUrl = CASCADE_ADDRESS ? addrUrl(CASCADE_ADDRESS) : '#'
  return (
    <>
      <PageHead
        title="Usage & Risks | Cascade"
        description={`What Cascade is, who runs it, and the risks of using smart contract software on ${NETWORK_LABEL}.`}
      />
      <LegalLayout
        title="Usage &amp; Risks"
        sections={SECTIONS}
        onHome={onHome}
        lastUpdated="31 Oct 2026"
      >

        <LegalSection id="who-runs-cascade" num={1} title="Who runs Cascade">
          <p className="md-p">
            Cascade is an independent open-source project. There is no company behind it and no protocol fee.
          </p>
          <p className="md-p">
            For support and security reports, contact{' '}
            <a href={CONTACT_MAILTO} className="md-link">{CONTACT_EMAIL}</a>.
          </p>
        </LegalSection>

        <LegalSection id="your-wallet" num={2} title="You control your wallet">
          <p className="md-p">
            Cascade never holds your private keys and never signs transactions on your behalf.
            Every action — creating an objective, delegating, approving, claiming — is a transaction
            that your browser wallet presents to you for review and signature. You can always
            choose not to sign.
          </p>
          <p className="md-p">
            Cascade connects to browser-extension wallets only (MetaMask and compatible extensions).
            There is no WalletConnect relay and no custodial service.
          </p>
        </LegalSection>

        <LegalSection id="contract-holds-funds" num={3} title="The contract holds the funds">
          <p className="md-p">
            USDC is held by the Cascade smart contract, not by the operator. The contract address
            on {NETWORK_LABEL} is{' '}
            {CASCADE_ADDRESS ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="md-link"
              >
                <code className="md-inline-code">{CASCADE_ADDRESS}</code>
              </a>
            ) : (
              <em>not yet deployed</em>
            )}.
          </p>
          <p className="md-p">
            The operator cannot move, freeze, or recover funds from the contract. The contract
            has no owner function, no pause function, and no upgrade path. It is fully immutable
            and will continue to work exactly as deployed for as long as the Arc network exists,
            even if the Cascade website goes offline.
          </p>
        </LegalSection>

        <LegalSection id="final-transactions" num={4} title="Transactions are real and final">
          <p className="md-p">
            Onchain actions cannot be undone. A wrong manager address, an incorrect amount, or
            a deadline set too early cannot be reversed by anyone — not by you, not by the operator,
            and not by the contract. Review every transaction carefully before signing it.
          </p>
          <p className="md-p">
            The application shows you a summary before you sign. Take a moment to read it.
          </p>
        </LegalSection>

        <LegalSection id="no-audit" num={5} title="No external audit">
          <p className="md-p">
            The Cascade contract has not been audited by an independent security firm. It has
            112 automated Foundry tests covering unit, fuzz, invariant, and adversarial scenarios,
            but tests do not guarantee the absence of bugs.
          </p>
          <p className="md-p">
            Use small amounts while the contract is unaudited. See the{' '}
            <a
              href="/security"
              onClick={e => { e.preventDefault(); contentNavigate('/security') }}
              className="md-link"
            >
              Security
            </a>{' '}
            page for the full picture.
          </p>
        </LegalSection>

        <LegalSection id="no-guarantees" num={6} title="No guarantees">
          <p className="md-p">
            Cascade cannot guarantee that every situation can be recovered. For example, funds
            assigned to a failed child return to the parent automatically, but a commitment that
            is never submitted and whose deadline never expires will hold funds indefinitely
            unless the approver cancels it or someone calls <code className="md-inline-code">expire</code> once the deadline passes.
          </p>
          <p className="md-p">
            The website, the RPC endpoint, and the block explorer may be unavailable at times.
            The contract itself stays usable directly onchain even when the website is down —
            you can always interact with it using a tool like{' '}
            <a href="https://getfoundry.sh" target="_blank" rel="noreferrer" className="md-link">cast</a>{' '}
            or any Ethereum-compatible client.
          </p>
          <p className="md-p">
            This software is provided as-is, without warranty of any kind.
          </p>
        </LegalSection>

        <LegalSection id="public-data" num={7} title="Public data">
          <p className="md-p">
            Everything you write to the contract is public and permanent. This includes wallet
            addresses, objective titles, delivery references (the text or link you submit as proof
            of work), amounts, deadlines, and all state changes. It cannot be deleted or hidden.
            Think carefully before putting sensitive information in a title or delivery reference.
          </p>
        </LegalSection>

        <LegalSection id="network" num={8} title="Network">
          {IS_MAINNET ? (
            <>
              <p className="md-p">
                Cascade V1 is deployed on <strong>Arc Mainnet</strong> (chain id 5042).
                USDC on Arc Mainnet has real monetary value. Creating or settling a commitment
                transfers real USDC. Do not sign transactions unless you understand and intend
                the outcome.
              </p>
              <p className="md-p">
                Cascade has not undergone an independent professional security audit. Use amounts
                you are comfortable losing in the event of an undiscovered bug.
              </p>
            </>
          ) : (
            <>
              <p className="md-p">
                This instance of Cascade is connected to <strong>Arc Testnet</strong> (chain id 5042002).
                Test USDC has no monetary value. Do not treat testnet interactions as financially
                binding agreements.
              </p>
              <p className="md-p">
                Cascade V1 is also deployed on Arc Mainnet (chain id 5042) at{' '}
                <a
                  href="https://explorer.arc.io/address/0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f"
                  target="_blank"
                  rel="noreferrer"
                  className="md-link"
                >
                  0x05B07ed8F2efAc05E20eCeeb0d8816248C73F14f
                </a>.
                See the{' '}
                <a
                  href="/docs/networks-and-addresses"
                  onClick={e => { e.preventDefault(); contentNavigate('/docs/networks-and-addresses') }}
                  className="md-link"
                >
                  Networks and addresses
                </a>{' '}
                article for details.
              </p>
            </>
          )}
        </LegalSection>

        <LegalSection id="changes" num={9} title="Changes to this page">
          <p className="md-p">
            This page may be updated as the project evolves. The last-updated date is shown
            at the top. Continued use of the application after a change constitutes acceptance
            of the revised content.
          </p>
        </LegalSection>

      </LegalLayout>
    </>
  )
}
