/**
 * Report data model for the capability-probe harness (RD-03, plan doc 03-02/03-04).
 *
 * Phase 1 defines the types every later phase populates; the builder,
 * recommendation derivation, table renderer, and JSON serializer land in Phase 5
 * (see plan doc 03-04). The schema contains ONLY these fields — there is no
 * free-form environment map — so no secret can leak through the report (AR-17).
 *
 * The `.js` extensions in the import specifiers are required by NodeNext ESM
 * resolution (they resolve to the `.ts` sources during development via tsx).
 */
import type { ColorDepth, Platform, UnicodeCaps } from '../../src/engine/index.js';

/** How a capability result was obtained. */
export type ProbeMethod = 'auto' | 'manual';

/** One capability result. `supported: null` means "could not determine" (AR-11). */
export interface ProbeResult {
  readonly supported: boolean | null;
  readonly method: ProbeMethod;
  readonly note?: string;
}

/** The recommendation block: key fields echoed from the resolved profile (AR-10). */
export interface Recommendation {
  readonly colorDepth: ColorDepth;
  readonly mouse: boolean;
  readonly unicodeWidth: UnicodeCaps['widthMode'];
  readonly altScreen: boolean;
  readonly bracketedPaste: boolean;
}

/** The full per-run report; `terminal-matrix.json` is a JSON array of these. */
export interface Report {
  readonly terminal: string;
  readonly version: string | null;
  readonly os: Platform;
  readonly term: string | null;
  readonly colorterm: string | null;
  readonly termProgram: string | null;
  readonly multiplexer: boolean;
  readonly timestamp: string;
  readonly results: Record<string, ProbeResult>;
  readonly recommendation: Recommendation;
}
