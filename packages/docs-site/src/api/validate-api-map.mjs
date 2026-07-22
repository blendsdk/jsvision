// Structural validation of API_MAP — the guard that keeps a malformed row from
// shipping a dead cross-link. Pure: returns the list of violations (empty = valid)
// so both the vitest spec and the build gate can assert on it.

/** The unscoped packages the reference covers. */
const PACKAGES = new Set(['core', 'ui', 'files', 'forms', 'datagrid']);

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
    if (seen.has(link.symbol)) violations.push(`duplicate symbol: ${link.symbol}`);
    seen.add(link.symbol);

    if (!PACKAGES.has(link.pkg)) violations.push(`unknown pkg '${link.pkg}' for symbol ${link.symbol}`);
    if (!link.apiPath.startsWith(`/api/${link.pkg}/`)) {
      violations.push(`apiPath not under /api/${link.pkg}/: ${link.apiPath}`);
    }
    if (!link.componentPage.startsWith('/components/')) {
      violations.push(`componentPage not under /components/: ${link.componentPage}`);
    }
  }

  return violations;
}
