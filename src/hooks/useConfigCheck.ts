/**
 * useConfigCheck — re-exports from the singleton store in src/lib/configCheck.ts.
 * Kept here so existing import paths don't need updating.
 */
export type {
  ConfigCheckStatus,
  ConfigCheckResult,
} from '@/lib/configCheck'

export {
  useConfigCheck,
  retryConfigCheck,
  useChainIdWatcher,
  EXPECTED_CONFIG_KEY,
} from '@/lib/configCheck'
