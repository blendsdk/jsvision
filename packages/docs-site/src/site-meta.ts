/**
 * Site identity shown by the demo shell's About dialog. The version is injected
 * at build time from the monorepo root package.json via a Vite `define`, so the
 * About box never drifts from the shipped version. The `typeof` guard keeps this
 * safe if the module is ever evaluated without the define in place (it falls back
 * to a neutral `0.0.0`).
 */

/** Name, version, and canonical links for the JSVision docs site. */
export const SITE_META = {
  /** Product name. */
  name: 'JSVision',
  /** Version, injected from the root package.json at build time. */
  version: typeof __JSVISION_VERSION__ !== 'undefined' ? __JSVISION_VERSION__ : '0.0.0',
  /** Canonical links. */
  links: {
    /** Source repository. */
    repo: 'https://github.com/blendsdk/jsvision',
    /** Docs home (site root). */
    docs: '/',
  },
} as const;
