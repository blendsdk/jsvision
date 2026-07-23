import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { DEFAULT_ROOTS, DRIFT_PAIRS, readRegion } from './check-plugin.mjs';

/**
 * Replace the first TypeScript fenced block in a page with a verified source region.
 *
 * @param {string} markdown Skill reference text.
 * @param {string} region Executable example source.
 * @returns {string} Updated markdown, or the original when no block exists.
 * @example
 * replaceFencedBlock('```ts\nold\n```', 'new');
 */
export function replaceFencedBlock(markdown, region) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.trim() === '```ts');
  if (start === -1) return markdown;
  const end = lines.findIndex((line, index) => index > start && line.trim() === '```');
  if (end === -1) return markdown;
  return [...lines.slice(0, start + 1), ...region.split('\n'), ...lines.slice(end)].join('\n');
}

/**
 * Synchronize drifted executable examples into the canonical skill.
 *
 * @param {{ kind: string, module?: string }[]} findings Drift findings from the read-only gate.
 * @param {{ skillRoot: string, recipeDir: string }} [roots] Injectable source locations.
 * @returns {string[]} Updated recipe module names.
 * @example
 * fixSnippetDrift([{ kind: 'snippet-drift', module: 'data-grid' }]);
 */
export function fixSnippetDrift(findings, roots = DEFAULT_ROOTS) {
  const updated = [];
  for (const finding of findings) {
    if (finding.kind !== 'snippet-drift' || typeof finding.module !== 'string') continue;
    const pair = DRIFT_PAIRS.find(({ module }) => module === finding.module);
    if (pair === undefined) continue;
    const region = readRegion(finding.module, roots);
    if (region === null) continue;
    const path = join(roots.skillRoot, pair.md);
    writeFileSync(path, replaceFencedBlock(readFileSync(path, 'utf8'), region));
    updated.push(finding.module);
  }
  return updated;
}
