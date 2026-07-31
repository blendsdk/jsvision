// Structural validation of API_MAP — the guard that keeps a malformed row from
// shipping a dead cross-link. Pure: returns the list of violations (empty = valid)
// so both the vitest spec and the build gate can assert on it.

import { parseComponentTarget } from './component-target.mjs';
import { PACKAGES } from './packages.mjs';

/** Package names derived from the generator's authoritative package list. */
const PACKAGE_NAMES = new Set(PACKAGES.map((pkg) => pkg.name));

/**
 * Check API_MAP for structural problems and return a list of human-readable
 * violation messages (empty when the map is well-formed): a duplicate `symbol`,
 * an unknown `pkg`, an `apiPath` not under `/api/<pkg>/`, or a `componentPage`
 * not under `/components/`.
 *
 * @param {import('./api-map.mjs').ApiLink[]} map
 * @returns {string[]} One message per violation; `[]` when valid.
 *
 * @example
 * validateApiMap([
 *   { symbol: 'Button', pkg: 'ui', apiPath: '/api/ui/classes/Button', componentPage: '/components/controls/button' },
 * ]); // → []
 */
export function validateApiMap(map) {
  const violations = [];
  const seen = new Set();

  for (const link of map) {
    const symbolKey = `${link.pkg}:${link.symbol}`;
    if (seen.has(symbolKey)) violations.push(`duplicate symbol: ${symbolKey}`);
    seen.add(symbolKey);

    if (!PACKAGE_NAMES.has(link.pkg)) violations.push(`unknown pkg '${link.pkg}' for symbol ${link.symbol}`);
    const apiPrefix = `/api/${link.pkg}/`;
    const apiSuffix = link.apiPath.slice(apiPrefix.length);
    const canonicalApiPath =
      link.apiPath.startsWith(apiPrefix) &&
      apiSuffix !== '' &&
      !apiSuffix.includes('\\') &&
      !apiSuffix.includes('%') &&
      !apiSuffix.includes('?') &&
      !apiSuffix.includes('#') &&
      apiSuffix.split('/').every((segment) => /^[A-Za-z0-9._-]+$/.test(segment) && segment !== '.' && segment !== '..');
    if (!canonicalApiPath) {
      violations.push(`apiPath not under /api/${link.pkg}/: ${link.apiPath}`);
    }
    try {
      parseComponentTarget(link.componentPage);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      violations.push(`invalid componentPage '${link.componentPage}': ${reason}`);
    }
  }

  return violations;
}
