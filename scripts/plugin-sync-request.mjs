// Pure catalog-entry request builder for the plugin self-sync AI path.
//
// It turns an undocumented-widget finding into a model request grounded strictly in that widget's
// own JSDoc + @example (no invented behavior), plus the pure write-side splice that applies a
// drafted bullet. Both the local skill and the API script consume this one module, so the drafting
// contract has a single home and a single test.

import { CATALOG, extractUiClassDoc } from './check-plugin.mjs';

/** The deterministic holding heading a freshly-drafted bullet lands under, for a human to re-file. */
export const NEEDS_CATEGORISATION = 'New — needs categorization';

/**
 * Read a widget's JSDoc lead sentence + `@example` from the `@jsvision/ui` barrel.
 *
 * @param {string} name The exported class name (from `detectDrift`).
 * @returns {{ lead: string, example: string }} The grounding doc.
 * @throws {Error} When `name` is not a `@jsvision/ui` class export.
 * @example
 * const { lead, example } = readWidgetDoc('Button');
 */
export function readWidgetDoc(name) {
  const doc = extractUiClassDoc(name);
  if (doc === null) throw new Error(`plugin-sync: no @jsvision/ui class export named "${name}"`);
  return doc;
}

/**
 * Build the drafting request for one undocumented widget, grounded in its JSDoc + `@example`. The
 * request is data — both the skill and the API script call this, so the prompt has one home and one
 * test. The target is the deterministic holding heading; a human re-files the bullet during review.
 *
 * @param {string} name The exported class name.
 * @returns {{ system: string, user: string, target: { file: string, afterHeading: string } }} The request.
 * @example
 * const req = buildCatalogEntryRequest('Button');
 * const bullet = await client.draft(req);
 */
export function buildCatalogEntryRequest(name) {
  const { lead, example } = readWidgetDoc(name);
  return {
    system:
      'You draft ONE markdown bullet for a TUI component catalog. Ground every word in the provided ' +
      'JSDoc and example. Do not invent behavior. Match the existing bullet style: ' +
      '"- **Name** — one sentence; a short usage hint.".',
    user: `Widget: ${name}\nJSDoc: ${lead}\nExample:\n${example}\n\nReturn only the bullet line.`,
    target: { file: CATALOG, afterHeading: NEEDS_CATEGORISATION },
  };
}

/**
 * Insert a drafted bullet under a heading in the catalog text (pure). Creates the holding section at
 * the end of the file when the heading is absent. This is the write side shared by the skill and the
 * API script; `detectDrift`'s barrel-coverage then confirms the entry exists.
 *
 * @param {string} mdText The catalog markdown.
 * @param {string} bullet The drafted bullet line (e.g. `- **Ghost** — a widget.`).
 * @param {string} heading The section heading text (without the `## ` prefix).
 * @returns {string} The catalog with the bullet inserted.
 * @example
 * const next = applyCatalogEntry(catalog, '- **Ghost** — a widget.', NEEDS_CATEGORISATION);
 */
export function applyCatalogEntry(mdText, bullet, heading) {
  const headingLine = `## ${heading}`;
  const lines = mdText.split('\n');
  const idx = lines.findIndex((l) => l.trim() === headingLine);
  if (idx === -1) {
    const trimmed = mdText.replace(/\s*$/, ''); // append the holding section at the file's end
    return `${trimmed}\n\n${headingLine}\n\n${bullet}\n`;
  }
  // Insert as the first item under the heading, after its blank line if present.
  let insertAt = idx + 1;
  if (lines[insertAt] !== undefined && lines[insertAt].trim() === '') insertAt += 1;
  lines.splice(insertAt, 0, bullet);
  return lines.join('\n');
}
