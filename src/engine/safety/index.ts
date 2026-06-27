/**
 * Public entry point of the RD-08 safety subsystem.
 *
 * Re-exports the subsystem's public API so the SDK's top-level
 * `src/engine/index.ts` can surface it. Currently the canonical
 * {@link sanitize} injection boundary, relocated here from RD-04's render
 * module (AR-3/AR-13); later RD-08 phases add the essentials gate, typed error
 * model, screen-safe logger, and redaction helpers.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM
 * resolution (it resolves to the `.ts` source during development via tsx).
 */

// Canonical output sanitizer — the primary injection boundary.
export { sanitize } from './sanitize.js';
