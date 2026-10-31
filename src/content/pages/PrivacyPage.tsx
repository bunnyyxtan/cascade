/**
 * PrivacyPage — currently UNPUBLISHED (PUBLISHED.privacy = false).
 * ContentApp renders NotFound instead while this flag is false.
 *
 * To publish: confirm the hosting provider's name and log-retention policy,
 * fill in the {{HOSTING}} section below, then set PUBLISHED.privacy = true
 * in src/content/site.ts.
 *
 * {{HOSTING}} — replace this comment with the hosting provider paragraph:
 *   <strong>Hosting provider</strong> (NAME): receives the IP address and
 *   headers of every HTTP request to the website. Logs are retained for N days.
 *
 * A test asserts that privacy stays unpublished while "{{HOSTING}}" is present
 * in this file's source text. Remove the {{HOSTING}} marker only when you have
 * replaced it with real content and set PUBLISHED.privacy = true.
 */
import { PageHead } from '../PageHead'
import { LegalLayout, LegalSection } from '../LegalLayout'
import { CONTACT_MAILTO, CONTACT_EMAIL } from '../site'
import { NETWORK_LABEL, RPC_URL } from '@/lib/network'

const SECTIONS = [
  { id: 'overview',        title: 'Overview' },
  { id: 'wallet',          title: 'Your wallet' },
  { id: 'third-parties',   title: 'Third-party services' },
  { id: 'onchain-data',    title: 'Public onchain data' },
  { id: 'browser-storage', title: 'Browser storage' },
  { id: 'no-cookies',      title: 'No cookies or analytics' },
  { id: 'contact',         title: 'Contact' },
]

export function PrivacyPage({ onHome }: { onHome: () => void }) {
  return (
    <>
      <PageHead
        title="Privacy — Cascade"
        description="What information Cascade and its third-party services collect when you use the application."
        noIndex
      />
      <LegalLayout title="Privacy" sections={SECTIONS} onHome={onHome} lastUpdated="31 Oct 2026">

        <LegalSection id="overview" num={1} title="Overview">
          <p className="md-p">
            This page describes what information is collected when you use the Cascade web
            application.
            The application itself does not collect or store user data on any server controlled
            by the operator. The third-party services described below operate independently
            and under their own privacy policies.
          </p>
        </LegalSection>

        <LegalSection id="wallet" num={2} title="Your wallet">
          <p className="md-p">
            Cascade connects to browser-extension wallets only (MetaMask and compatible
            extensions). There is no WalletConnect relay. Your wallet address becomes visible
            to Cascade only after you connect and approve the connection in your wallet.
          </p>
          <p className="md-p">
            Cascade does not store your wallet address on any server. Your connected address
            is only used locally in the browser to read your commitments and claimable balance.
          </p>
        </LegalSection>

        <LegalSection id="third-parties" num={3} title="Third-party services">
          <p className="md-p">
            <strong>Arc RPC node</strong>{' '}
            (<code className="md-inline-code">{RPC_URL.replace(/^https?:\/\//, '')}</code> — {NETWORK_LABEL}):
            every blockchain read and transaction your browser makes passes through this endpoint.
            It receives your IP address, the request content (including any wallet addresses you
            query), and any transactions you submit.
          </p>
          <p className="md-p">
            <strong>Ethereum mainnet public RPC</strong>: ConnectKit may perform an ENS
            name lookup for your connected wallet address through a public Ethereum mainnet
            RPC. If it does, that RPC receives your IP address and wallet address. This is
            a wagmi/ConnectKit default behaviour.
          </p>
          <p className="md-p">
            <strong>Google Fonts</strong> (fonts.googleapis.com, fonts.gstatic.com):
            fonts are loaded from Google Fonts servers, which receive your IP address
            and browser user-agent string.
          </p>
          {/*
            {{HOSTING}} — Insert hosting provider paragraph here before publishing.
            Example:
            <p className="md-p">
              <strong>Hosting provider</strong> (NAME): receives the IP address and
              headers of every HTTP request to this website. Logs are retained for N days.
            </p>
          */}
        </LegalSection>

        <LegalSection id="onchain-data" num={4} title="Public onchain data">
          <p className="md-p">
            Everything you write to the Cascade contract is permanently public on the Arc
            blockchain. This includes your wallet address, objective titles, delivery
            references, amounts, deadlines, and all state transitions. This data cannot
            be edited or deleted. Do not write sensitive information into a title or
            delivery reference.
          </p>
        </LegalSection>

        <LegalSection id="browser-storage" num={5} title="Browser storage">
          <p className="md-p">
            Cascade stores the following data in your browser's{' '}
            <code className="md-inline-code">localStorage</code>. All of it is local to your
            browser and is never sent to any server by the application.
          </p>
          <ul className="md-ul">
            <li className="md-li">
              <code className="md-inline-code">cascade:history:*</code> — a cache of public
              chain events, so the application does not need to re-fetch the full history on
              every page load.
            </li>
            <li className="md-li">
              Block-timestamp cache — a map from block numbers to timestamps, used to
              display human-readable dates.
            </li>
            <li className="md-li">
              wagmi and ConnectKit connection state — your most recent wallet connector
              choice and connection status, so the wallet can reconnect automatically on
              the next visit.
            </li>
          </ul>
          <p className="md-p">
            You can clear all of this data at any time by clearing your browser's site
            data for this origin (typically in browser Settings under Privacy or Storage).
          </p>
        </LegalSection>

        <LegalSection id="no-cookies" num={6} title="No cookies or analytics">
          <p className="md-p">
            The application does not set any cookies. It does not include any analytics,
            telemetry, or error-reporting SDK. No usage data is collected by the operator.
          </p>
          <p className="md-p">
            The Arc Studio development environment (used during development, not on the
            public site) adds instrumentation for RPC tracing and console capture. This is
            only active when the page is loaded inside the Arc Studio preview iframe and
            is never present in a production build.
          </p>
        </LegalSection>

        <LegalSection id="contact" num={7} title="Contact">
          <p className="md-p">
            For privacy-related questions, email{' '}
            <a href={CONTACT_MAILTO} className="md-link">{CONTACT_EMAIL}</a>.
          </p>
          <p className="md-p">
            When you send an email, your email address and message content will be visible
            to the operator. Emails are not automatically shared with third parties.
          </p>
        </LegalSection>

      </LegalLayout>
    </>
  )
}
