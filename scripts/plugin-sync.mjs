// Self-sync CLI for the jsvision Claude Code plugin.
//
// It turns each deterministic drift finding from `detectDrift()` (in check-plugin.mjs) into a fix:
//   - snippet drift     → a deterministic re-sync (copy the source module's #region into the .md)
//   - undocumented widget → an AI-drafted catalog bullet (wired in a later step, behind an injected
//                           client seam so tests never hit the network)
//
// The pure functions are exported so their behavior is spec-tested; `main()` is guarded so importing
// this module has no side effects. Every mutating function takes an injectable `roots` object so
// tests run against a temp-dir copy and never touch the repo.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { DEFAULT_ROOTS, detectDrift, DRIFT_PAIRS, readRegion } from './check-plugin.mjs';
import { applyCatalogEntry, buildCatalogEntryRequest } from './plugin-sync-request.mjs';
import { writeApiDocs } from './gen-plugin-api.mjs';

/**
 * @typedef {import('./check-plugin.mjs').DriftFinding} DriftFinding
 * @typedef {import('./check-plugin.mjs').DriftRoots} DriftRoots
 * @typedef {{ draft(request: { system: string, user: string }): Promise<string> }} DraftClient
 */

/** The recipe/authoring page a module's snippet is embedded in. */
function driftMdFor(module) {
  const pair = DRIFT_PAIRS.find((p) => p.module === module);
  return pair === undefined ? null : pair.md;
}

/**
 * Replace the body of a markdown page's first ` ```ts ` fenced block with `region`, byte-for-byte.
 * It is the inverse of the gate's snippet-drift check: after it, `checkDrift(result, region)` passes.
 * Returns the text unchanged when the page has no fenced block to replace.
 *
 * @param {string} mdText The markdown page content.
 * @param {string} region The source module's `#region example` text.
 * @returns {string} The page with its embedded block re-synced to `region`.
 * @example
 * const fixed = replaceFencedBlock(pageMarkdown, readRegion('data-grid'));
 */
export function replaceFencedBlock(mdText, region) {
  const lines = mdText.split('\n');
  const start = lines.findIndex((l) => l.trim() === '```ts');
  if (start === -1) return mdText;
  const end = lines.findIndex((l, i) => i > start && l.trim() === '```');
  if (end === -1) return mdText;
  const before = lines.slice(0, start + 1); // up to and including the ```ts opener
  const after = lines.slice(end); // from the closing ``` onward
  return [...before, ...region.split('\n'), ...after].join('\n');
}

/**
 * Re-sync every `snippet-drift` finding by copying its source module's `#region example` into the
 * owning page. Deterministic — no AI, no network. Non-snippet findings are ignored. Leaves the
 * changed pages unstaged for human review.
 *
 * @param {DriftFinding[]} findings The drift set (typically from `detectDrift()`).
 * @param {DriftRoots} [roots] Defaults to the real tree; a test passes a temp-dir `roots` so the
 *   write lands in a fixture, not the repo (the filesystem analogue of the injected model client).
 * @returns {string[]} The module names that were re-synced (empty when there was nothing to fix).
 * @example
 * const fixed = fixSnippetDrift(detectDrift()); // → ['data-grid']
 */
export function fixSnippetDrift(findings, roots = DEFAULT_ROOTS) {
  const fixed = [];
  for (const f of findings) {
    if (f.kind !== 'snippet-drift') continue;
    const mdRel = driftMdFor(f.module);
    if (mdRel === null) continue; // not a known recipe pair — skip before any filesystem read
    const region = readRegion(f.module, roots);
    if (region === null) continue; // no source region to copy (a runAllChecks error, not ours to fix)
    const mdPath = join(roots.skillRoot, mdRel);
    writeFileSync(mdPath, replaceFencedBlock(readFileSync(mdPath, 'utf8'), region));
    fixed.push(f.module);
  }
  return fixed;
}

/**
 * Trim a model's reply down to a single catalog-style bullet line. The request asks for only the
 * bullet, but this defends against stray whitespace or a leading blank line and guarantees the
 * `- ` prefix the catalog style requires.
 *
 * @param {string} text The raw model reply.
 * @returns {string} A single `- ...` bullet line.
 * @example
 * normalizeBullet('\n- **Ghost** — a widget.\n'); // → '- **Ghost** — a widget.'
 */
export function normalizeBullet(text) {
  const lines = String(text)
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const first = lines.find((l) => l.startsWith('-')) ?? lines[0] ?? '';
  return `- ${first.replace(/^-\s*/, '')}`;
}

/**
 * Draft + apply a `component-catalog.md` bullet for each undocumented-widget finding, via an injected
 * model client (never the SDK directly). Each bullet is grounded in the widget's real JSDoc, drafted
 * by `client.draft`, normalized, and spliced under the holding heading. Non-widget findings are
 * ignored. The barrel-coverage gate then confirms the entry exists; a human confirms it is accurate.
 *
 * @param {DriftFinding[]} findings The drift set (typically from `detectDrift()`).
 * @param {DraftClient} client Injected — the real Anthropic client in prod, a fake in tests.
 * @param {DriftRoots} [roots] Defaults to the real tree; a test passes a temp-dir catalog so the
 *   write lands in a fixture, not the repo (the filesystem analogue of the injected client).
 * @returns {Promise<string[]>} The widget names whose entries were drafted + written.
 * @example
 * const client = { draft: async () => '- **Ghost** — a widget.' };
 * await fixUndocumentedWidgets(detectDrift(), client);
 */
export async function fixUndocumentedWidgets(findings, client, roots = DEFAULT_ROOTS) {
  const done = [];
  for (const f of findings) {
    if (f.kind !== 'undocumented-widget') continue;
    const req = buildCatalogEntryRequest(f.name); // grounded in the real widget's JSDoc + @example
    const bullet = normalizeBullet(await client.draft(req));
    const md = readFileSync(roots.catalogPath, 'utf8');
    writeFileSync(roots.catalogPath, applyCatalogEntry(md, bullet, req.target.afterHeading));
    done.push(f.name);
  }
  return done;
}

async function main(argv = process.argv.slice(2)) {
  if (argv.includes('--detect')) {
    process.stdout.write(`${JSON.stringify(detectDrift(), null, 2)}\n`);
    return;
  }
  if (argv.includes('--fix')) {
    const fixed = fixSnippetDrift(detectDrift());
    process.stdout.write(
      fixed.length > 0 ? `synced ${fixed.length} snippet(s): ${fixed.join(', ')}\n` : 'no snippets to sync\n',
    );
    const apiPages = writeApiDocs();
    process.stdout.write(`regenerated ${apiPages.length} API reference page(s)\n`);
    return;
  }

  // No flag → full sync: deterministic snippet fixes first, then AI-drafted catalog entries via the
  // real Anthropic client (imported lazily so importing this module — as tests do — never loads the
  // SDK and never needs a key).
  const findings = detectDrift();
  const fixedSnippets = fixSnippetDrift(findings);
  if (fixedSnippets.length > 0) {
    process.stdout.write(`synced ${fixedSnippets.length} snippet(s): ${fixedSnippets.join(', ')}\n`);
  }

  const apiPages = writeApiDocs();
  process.stdout.write(`regenerated ${apiPages.length} API reference page(s)\n`);

  const undocumented = findings.filter((f) => f.kind === 'undocumented-widget');
  if (undocumented.length === 0) {
    process.stdout.write('no undocumented widgets to draft\n');
  } else {
    const { createAnthropicClient } = await import('./plugin-sync-anthropic.mjs');
    const drafted = await fixUndocumentedWidgets(undocumented, createAnthropicClient());
    process.stdout.write(
      `drafted ${drafted.length} catalog entr${drafted.length === 1 ? 'y' : 'ies'}: ${drafted.join(', ')}\n`,
    );
  }
  process.stdout.write('review the unstaged changes, then run `yarn verify` before committing.\n');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    process.stderr.write(`plugin:sync failed: ${err?.message ?? err}\n`);
    process.exitCode = 1;
  });
}
