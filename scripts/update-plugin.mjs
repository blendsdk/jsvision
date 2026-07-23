#!/usr/bin/env node

import { cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { detectDrift } from './check-plugin.mjs';
import { writeApiDocs } from './gen-plugin-api.mjs';
import { fixSnippetDrift } from './plugin-sync.mjs';
import { checkPluginImpact, updatePluginImpact } from './plugin-impact.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CANONICAL_SKILL = join(ROOT, 'tools', 'jsvision-skill');
const DISTRIBUTED_SKILL = join(ROOT, 'plugins', 'jsvision-plugin', 'skills', 'jsvision');

/**
 * Regenerate source-derived skill material and assemble the Codex distribution.
 *
 * Semantic guidance remains human-reviewed; this function owns only deterministic output.
 *
 * @returns {{ snippets: string[], apiPages: string[] }} Updated generated material.
 * @example
 * updatePlugin();
 */
export function updatePlugin() {
  const impact = checkPluginImpact();
  const snippets = fixSnippetDrift(detectDrift());
  const apiPages = writeApiDocs();
  updatePluginImpact();
  rmSync(DISTRIBUTED_SKILL, { recursive: true, force: true });
  cpSync(CANONICAL_SKILL, DISTRIBUTED_SKILL, { recursive: true });
  return { snippets, apiPages, impact };
}

function main() {
  const result = updatePlugin();
  process.stdout.write(
    `Updated ${result.apiPages.length} API pages and ${result.snippets.length} executable snippets.\n`,
  );
  for (const area of result.impact) {
    process.stdout.write(`Reviewed ${area.name}: ${area.references.join(', ')}\n`);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
