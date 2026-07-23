import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REGISTRY_PATH = join(ROOT, 'tools', 'jsvision-plugin-impact.json');

function filesUnder(path) {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true })
    .flatMap((entry) => filesUnder(join(path, entry.name)))
    .sort();
}

function fingerprint(paths) {
  const hash = createHash('sha256');
  for (const configuredPath of paths) {
    for (const file of filesUnder(join(ROOT, configuredPath))) {
      hash.update(relative(ROOT, file));
      hash.update('\0');
      hash.update(readFileSync(file));
      hash.update('\0');
    }
  }
  return hash.digest('hex');
}

/** Read and validate the source-impact registry. */
export function readImpactRegistry() {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
  if (!Array.isArray(registry.areas) || registry.fingerprints === null || typeof registry.fingerprints !== 'object') {
    throw new Error('tools/jsvision-plugin-impact.json has an invalid shape');
  }
  return registry;
}

/**
 * Report source areas whose implementation changed after their last plugin review.
 *
 * @returns {{ name: string, references: string[] }[]} Areas requiring semantic review.
 * @example
 * checkPluginImpact();
 */
export function checkPluginImpact() {
  const registry = readImpactRegistry();
  return registry.areas
    .filter((area) => registry.fingerprints[area.name] !== fingerprint(area.paths))
    .map(({ name, references }) => ({ name, references }));
}

/**
 * Record that every mapped area has been reviewed against its skill references.
 *
 * Call only after reviewing the affected pages printed by {@link checkPluginImpact}.
 *
 * @returns {string[]} Area names recorded in the snapshot.
 * @example
 * updatePluginImpact();
 */
export function updatePluginImpact() {
  const registry = readImpactRegistry();
  registry.fingerprints = Object.fromEntries(registry.areas.map((area) => [area.name, fingerprint(area.paths)]));
  writeFileSync(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`);
  return registry.areas.map(({ name }) => name);
}
