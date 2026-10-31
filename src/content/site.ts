/**
 * Site-wide constants: operator, contact, and publication flags.
 * Source of truth: context/planning/v1-site-facts.md §Operator and §Publication rule.
 *
 * An unpublished page renders 404 and is removed from nav, footer, search and sitemap.
 * Currently unpublished: /privacy (hosting provider unknown).
 */

/**
 * Operator identity — not published publicly.
 * Cascade is the public identity; the individual operator is not named on the site.
 * If a legal disclosure ever requires naming an operator, flag this for the owner first.
 */
export const OPERATOR = {} as const

/**
 * Single contact address for support and security reports.
 * Used as `mailto:` link wherever a contact is needed.
 */
export const CONTACT_EMAIL = 'bunnyyxtan@gmail.com'
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}`

/**
 * Publication flags — one per content page.
 * false → route returns 404; page is not linked anywhere.
 */
export const PUBLISHED: Record<string, boolean> = {
  docs:          true,
  security:      true,
  faq:           true,
  support:       true,
  'usage-risks': true,
  privacy:       false,  // hosting provider not yet verified
}

/** Returns true when a page slug/key is published. */
export function isPublished(key: string): boolean {
  return PUBLISHED[key] === true
}
