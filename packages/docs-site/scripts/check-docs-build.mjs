#!/usr/bin/env node
// Structural assertions over the produced VitePress build (`.vitepress/dist`).
//
// Run this AFTER `yarn docs:build`; it never builds the site itself, it only
// inspects the artifacts the build left behind. Each assertion is a small,
// independent check so the suite can grow one site concern at a time. The
// process exits non-zero if any check fails — this is the seed of the CI docs
// gate, so a red check must break the pipeline.
//
// Usage:  node packages/docs-site/scripts/check-docs-build.mjs

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(siteRoot, '.vitepress', 'dist');

/** GitHub Pages project-site base — every root-absolute asset URL must carry it. */
const BASE = '/jsvision/';

/** Nav sections that must each resolve to a built HTML page (id → dist-relative path). */
const SECTIONS = {
  Home: 'index.html',
  Guide: 'guide/index.html',
  Components: 'components/index.html',
  Apps: 'apps/index.html',
  API: 'api/index.html',
  Reference: 'reference/index.html',
};

// --- tiny check harness ---------------------------------------------------

const results = [];

/**
 * Register + run one assertion. `fn` throws (or returns a failure string) to
 * fail; a clean return passes. Kept synchronous so ordering is obvious.
 */
function check(id, description, fn) {
  try {
    const detail = fn();
    results.push({ id, description, ok: true, detail: detail ?? '' });
  } catch (err) {
    results.push({ id, description, ok: false, detail: err.message });
  }
}

function fail(message) {
  throw new Error(message);
}

// --- fs helpers -----------------------------------------------------------

/** Recursively list every file under `dir` (absolute paths); [] if absent. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

/** All built HTML pages, as dist-relative POSIX paths. */
function htmlPages() {
  return walk(distDir)
    .filter((f) => f.endsWith('.html'))
    .map((f) => relative(distDir, f).split('\\').join('/'));
}

/**
 * Extract every `src="…"`/`href="…"` value that is a root-absolute local path
 * (starts with a single `/`). External (`//host`, `http…`, `mailto:`), anchor
 * (`#…`), inline (`data:`) and relative URLs are not asset paths and are skipped.
 */
function rootAbsoluteRefs(html) {
  const refs = [];
  const re = /(?:src|href)="([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (url.startsWith('/') && !url.startsWith('//')) refs.push(url);
  }
  return refs;
}

// --- ST-1: build produced a homepage with base-prefixed assets ------------

check('ST-1', 'Build output present + every root-absolute asset URL is base-prefixed', () => {
  if (!existsSync(distDir)) fail(`no build output at ${relative(siteRoot, distDir)} — run \`yarn docs:build\` first`);
  const home = join(distDir, 'index.html');
  if (!existsSync(home)) fail('dist/index.html is missing');

  const offenders = [];
  for (const page of htmlPages()) {
    const html = readFileSync(join(distDir, page), 'utf8');
    for (const url of rootAbsoluteRefs(html)) {
      if (!url.startsWith(BASE)) offenders.push(`${page}: ${url}`);
    }
  }
  if (offenders.length) {
    fail(`${offenders.length} asset URL(s) not under ${BASE}:\n    ${offenders.slice(0, 10).join('\n    ')}`);
  }
  return `dist/index.html present; all asset URLs under ${BASE}`;
});

// --- ST-2: each nav section built a page ----------------------------------

check('ST-2', 'Every nav section has a built HTML page', () => {
  const missing = Object.entries(SECTIONS)
    .filter(([, path]) => !existsSync(join(distDir, path)))
    .map(([id, path]) => `${id} (${path})`);
  if (missing.length) fail(`missing section page(s): ${missing.join(', ')}`);
  return `all ${Object.keys(SECTIONS).length} section pages built`;
});

// --- report + exit --------------------------------------------------------

let failed = 0;
for (const r of results) {
  const mark = r.ok ? '✅' : '❌';
  process.stdout.write(`${mark} ${r.id}  ${r.description}\n`);
  if (r.detail) process.stdout.write(`    ${r.detail}\n`);
  if (!r.ok) failed++;
}
process.stdout.write(`\n${results.length - failed}/${results.length} checks passed\n`);
process.exit(failed ? 1 : 0);
