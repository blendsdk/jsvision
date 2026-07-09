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
import yaml from 'js-yaml';

const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = join(siteRoot, '..', '..');
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

// --- ST-14: deploy workflow is well-formed and secret-safe ----------------

check('ST-14', 'docs.yml parses, triggers on site paths, safe permissions, only GITHUB_TOKEN', () => {
  const wfPath = join(repoRoot, '.github', 'workflows', 'docs.yml');
  if (!existsSync(wfPath)) fail('.github/workflows/docs.yml is missing');
  const raw = readFileSync(wfPath, 'utf8');

  let doc;
  try {
    doc = yaml.load(raw);
  } catch (err) {
    fail(`.github/workflows/docs.yml does not parse: ${err.message}`);
  }

  // YAML 1.1 folds a bare `on:` key to boolean true; js-yaml v4 keeps it a
  // string, but read both so the check is parser-agnostic.
  const on = doc?.on ?? doc?.[true];
  if (!on || typeof on !== 'object') fail('no `on:` trigger block');
  if (!on.push) fail('missing `push` trigger (production deploy)');
  if (!on.pull_request) fail('missing `pull_request` trigger (PR preview)');

  const pushBranches = [].concat(on.push.branches ?? []);
  if (!pushBranches.includes('master')) fail('`push` does not target `master`');

  // Both triggers must scope to the site inputs and NOT to docs/** (PF-009):
  // after migration docs/ holds only the non-website acceptance-gate.
  const required = ['packages/docs-site/**', '.github/workflows/docs.yml'];
  for (const [name, trig] of [
    ['push', on.push],
    ['pull_request', on.pull_request],
  ]) {
    const paths = [].concat(trig.paths ?? []);
    for (const need of required) {
      if (!paths.includes(need)) fail(`\`${name}\` paths missing ${need}`);
    }
    if (paths.some((p) => p.startsWith('docs/'))) {
      fail(`\`${name}\` still triggers on docs/** (should be packages/docs-site/**)`);
    }
  }

  const perms = doc.permissions ?? {};
  if (perms.contents !== 'write') fail('permissions.contents must be `write` (push gh-pages)');
  if (perms['pull-requests'] !== 'write') fail('permissions.pull-requests must be `write` (comment preview URL)');

  // No stored secret may be used; the ephemeral GITHUB_TOKEN is the only one allowed.
  const secretRefs = [...raw.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((m) => m[1]);
  const forbidden = secretRefs.filter((s) => s !== 'GITHUB_TOKEN');
  if (forbidden.length) fail(`uses stored secret(s): ${[...new Set(forbidden)].join(', ')}`);

  return 'workflow valid: push@master + pull_request on site paths, contents+PR write, GITHUB_TOKEN only';
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
