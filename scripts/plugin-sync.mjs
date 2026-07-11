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

/**
 * @typedef {import('./check-plugin.mjs').DriftFinding} DriftFinding
 * @typedef {import('./check-plugin.mjs').DriftRoots} DriftRoots
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

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--detect')) {
    process.stdout.write(`${JSON.stringify(detectDrift(), null, 2)}\n`);
    return;
  }
  if (argv.includes('--fix')) {
    const fixed = fixSnippetDrift(detectDrift());
    process.stdout.write(
      fixed.length > 0 ? `synced ${fixed.length} snippet(s): ${fixed.join(', ')}\n` : 'nothing to sync\n',
    );
    return;
  }
  // No flag → the AI path (draft catalog entries for undocumented widgets). Wired in a later step.
  process.stdout.write('plugin:sync — pass --fix to re-sync drifted recipe snippets deterministically.\n');
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
