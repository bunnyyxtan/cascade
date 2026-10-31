/**
 * Raw Markdown content for all docs guide articles.
 * Imported via Vite's ?raw feature — each is a plain string.
 * Dev docs (contracts, security, architecture, deployment, development)
 * are served from docs/ root; guide articles from docs/guide/.
 */

// Guide articles  (../../ = src/content → src → app root)
import overview              from '../../docs/guide/overview.md?raw'
import quickStart            from '../../docs/guide/quick-start.md?raw'
import networksAndAddresses  from '../../docs/guide/networks-and-addresses.md?raw'
import objectivesAndCommitments from '../../docs/guide/objectives-and-commitments.md?raw'
import delegationAndReserve  from '../../docs/guide/delegation-and-reserve.md?raw'
import statesAndPermissions  from '../../docs/guide/states-and-permissions.md?raw'
import moneyFlowAndReconciliation from '../../docs/guide/money-flow-and-reconciliation.md?raw'
import creatingAnObjective   from '../../docs/guide/creating-an-objective.md?raw'
import delegatingWork        from '../../docs/guide/delegating-work.md?raw'
import submittingAndReviewing from '../../docs/guide/submitting-and-reviewing.md?raw'
import cancellingAndExpiry   from '../../docs/guide/cancelling-and-expiry.md?raw'
import claimingUsdc          from '../../docs/guide/claiming-usdc.md?raw'
import troubleshooting       from '../../docs/guide/troubleshooting.md?raw'
import verifyingCascade      from '../../docs/guide/verifying-cascade.md?raw'
import limitations           from '../../docs/guide/limitations.md?raw'

// Developer reference docs
import contractsRef          from '../../docs/contracts.md?raw'
import securityRef           from '../../docs/security.md?raw'
import architectureRef       from '../../docs/architecture.md?raw'
import deploymentRef         from '../../docs/deployment.md?raw'
import developmentRef        from '../../docs/development.md?raw'

// Dev-time sanity check: if any value looks like a URL path instead of markdown,
// the ?raw import failed (e.g. assetsInclude was set and Vite served the file as an asset).
function assertRaw(values: string[]): void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    for (const v of values) {
      if (typeof v === 'string' && v.startsWith('/') && (v.includes('?raw') || v.endsWith('.md'))) {
        throw new Error(
          `[docsContent] ?raw import returned a URL ("${v.slice(0, 60)}") instead of markdown text. ` +
          'Check that assetsInclude does NOT contain **/*.md in vite.config.ts.',
        )
      }
    }
  }
}

export const DOCS_CONTENT: Record<string, string> = {
  overview,
  'quick-start':                quickStart,
  'networks-and-addresses':     networksAndAddresses,
  'objectives-and-commitments': objectivesAndCommitments,
  'delegation-and-reserve':     delegationAndReserve,
  'states-and-permissions':     statesAndPermissions,
  'money-flow-and-reconciliation': moneyFlowAndReconciliation,
  'creating-an-objective':      creatingAnObjective,
  'delegating-work':            delegatingWork,
  'submitting-and-reviewing':   submittingAndReviewing,
  'cancelling-and-expiry':      cancellingAndExpiry,
  'claiming-usdc':              claimingUsdc,
  troubleshooting,
  'verifying-cascade':          verifyingCascade,
  limitations,
  // Developer reference
  contracts:    contractsRef,
  security:     securityRef,
  architecture: architectureRef,
  deployment:   deploymentRef,
  development:  developmentRef,
}

assertRaw(Object.values(DOCS_CONTENT))
