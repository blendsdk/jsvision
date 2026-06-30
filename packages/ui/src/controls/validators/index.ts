/**
 * `controls/validators/` barrel — the RD-06 validator model (PA-12). The `Validator` shape plus the
 * `filter`/`range`/`lookup` factories (TV `TFilterValidator`/`TRangeValidator`/`TStringLookupValidator`).
 * `picture`/mask is deferred to RD-07 (DEF-02). The `.js` extension in import specifiers is required by
 * NodeNext ESM resolution.
 */
export type { Validator } from './types.js';
export { filter } from './filter.js';
export { range } from './range.js';
export { lookup } from './lookup.js';
