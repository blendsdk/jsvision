// Hand-written declaration for validate-api-map.mjs (plain ESM). The `ApiLink`
// shape is inlined here for the same reason as inject-back-links.d.mts beside
// it — api-map.mjs has no declaration file. Declares only the one exported
// function the spec test consumes.

/** One component↔reference link, matching the map's row shape. */
interface ApiLink {
  symbol: string;
  pkg: 'core' | 'ui' | 'files' | 'forms' | 'datagrid';
  apiPath: string;
  componentPage: string;
}

/**
 * Check API_MAP for structural problems and return a list of human-readable
 * violation messages (empty when the map is well-formed): a duplicate
 * `symbol`, an unknown `pkg`, an `apiPath` not under `/api/<pkg>/`, or a
 * `componentPage` not under `/components/`.
 *
 * @param map The rows to validate.
 * @returns One message per violation; `[]` when valid.
 */
export declare function validateApiMap(map: readonly ApiLink[]): string[];
