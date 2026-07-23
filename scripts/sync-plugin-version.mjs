#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKAGE_MANIFEST = join(ROOT, 'packages', 'core', 'package.json');
const PLUGIN_MANIFEST = join(ROOT, 'plugins', 'jsvision-plugin', '.codex-plugin', 'plugin.json');
const DOCS_PAGE = join(ROOT, 'packages', 'docs-site', 'guide', 'codex-plugin.md');

/**
 * Synchronize the plugin manifest and tagged install documentation with the stable SDK version.
 *
 * @param {{ check?: boolean }} [options] Check without writing when true.
 * @returns {boolean} Whether every version already matched.
 * @example
 * syncPluginVersion({ check: true });
 */
export function syncPluginVersion({ check = false } = {}) {
  const version = JSON.parse(readFileSync(PACKAGE_MANIFEST, 'utf8')).version;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`invalid stable JSVision version: ${JSON.stringify(version)}`);
  }

  const plugin = JSON.parse(readFileSync(PLUGIN_MANIFEST, 'utf8'));
  const docs = readFileSync(DOCS_PAGE, 'utf8');
  const docsVersion = docs.match(/marketplace add blendsdk\/jsvision --ref v([^\s]+)/)?.[1];
  const matches = plugin.version === version && docsVersion === version;
  if (check || matches) return matches;

  plugin.version = version;
  writeFileSync(PLUGIN_MANIFEST, `${JSON.stringify(plugin, null, 2)}\n`);
  writeFileSync(
    DOCS_PAGE,
    docs.replace(
      /marketplace add blendsdk\/jsvision --ref v[^\s]+/,
      `marketplace add blendsdk/jsvision --ref v${version}`,
    ),
  );
  return false;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const check = process.argv.slice(2).includes('--check');
  const matched = syncPluginVersion({ check });
  if (check && !matched) {
    process.stderr.write('sync-plugin-version: plugin manifest or docs do not match packages/core.\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(`sync-plugin-version: ${matched ? 'already synchronized' : 'updated'}.\n`);
  }
}
