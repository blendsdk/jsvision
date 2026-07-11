#!/usr/bin/env node
// Generate the symbol-level API reference: one TypeDoc run per package into
// api/<pkg>/, then a single merged VitePress sidebar at api/typedoc-sidebar.json.
//
// Runs TypeDoc once per package (shared flags live in typedoc.json; the per-package
// entry point, out dir, and tsconfig are passed here) so the URLs stay clean —
// /api/<pkg>/<kind>/<Symbol> rather than /api/<pkg>/src/…. TypeDoc wipes each out
// dir before writing (cleanOutputDir), so a re-run regenerates from scratch with no
// stale files — the determinism the build gate asserts. api/index.md (the committed
// hand-written preface) is never touched, since it sits at api/, not api/<pkg>/.
//
// Usage:  node packages/docs-site/scripts/gen-api.mjs   (or `yarn docs:api`)

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_MAP } from '../src/api/api-map.mjs';
import { injectBackLink } from '../src/api/inject-back-links.mjs';

const require = createRequire(import.meta.url);
const siteRoot = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/docs-site
const apiDir = join(siteRoot, 'api');

/**
 * The public entry point of each documented package, each generated into api/<pkg>/.
 * `web` intentionally lists only its main barrel — the throwing `browser-stubs`
 * subpath is not an entry point, so it never appears in the reference.
 */
const PACKAGES = [
  { name: 'core', entry: '../core/src/engine/index.ts', tsconfig: '../core/tsconfig.json' },
  { name: 'ui', entry: '../ui/src/index.ts', tsconfig: '../ui/tsconfig.json' },
  { name: 'files', entry: '../files/src/index.ts', tsconfig: '../files/tsconfig.json' },
  { name: 'web', entry: '../web/src/index.ts', tsconfig: '../web/tsconfig.json' },
];

/** Absolute path to TypeDoc's CLI entry, resolved cross-platform (run via node). */
function typedocBin() {
  const pkgJson = require.resolve('typedoc/package.json');
  return join(dirname(pkgJson), JSON.parse(readFileSync(pkgJson, 'utf8')).bin.typedoc);
}

/** Run TypeDoc for one package; shared options are read from typedoc.json. */
function generate(bin, pkg) {
  execFileSync(
    process.execPath,
    [
      bin,
      '--options',
      'typedoc.json',
      '--entryPoints',
      pkg.entry,
      '--tsconfig',
      pkg.tsconfig,
      '--out',
      join('api', pkg.name),
    ],
    { cwd: siteRoot, stdio: 'inherit' },
  );
}

/**
 * Fold the four per-package sidebars into one array VitePress config reads for the
 * /api/ route, each package a collapsible top-level group. The intermediate
 * per-package sidebar files are removed so the merged file is the only sidebar.
 */
function mergeSidebars() {
  const merged = PACKAGES.map((pkg) => {
    const file = join(apiDir, pkg.name, 'typedoc-sidebar.json');
    const items = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    if (existsSync(file)) rmSync(file);
    return { text: pkg.name, collapsed: true, items };
  });
  writeFileSync(join(apiDir, 'typedoc-sidebar.json'), `${JSON.stringify(merged, null, 2)}\n`);
}

/**
 * Inject the "Documented in →" back-link into each mapped symbol's generated page.
 * The trees are regenerated (and wiped) every run, so the notes are re-applied
 * every build — never committed, never stale. Fails loud if a mapped symbol has no
 * generated page, so a stale map row can't silently ship a dead link.
 */
function injectBackLinks() {
  for (const link of API_MAP) {
    const file = join(siteRoot, `${link.apiPath.replace(/^\//, '')}.md`);
    if (!existsSync(file)) {
      throw new Error(`gen-api: API_MAP apiPath has no generated page: ${link.apiPath}`);
    }
    writeFileSync(file, injectBackLink(readFileSync(file, 'utf8'), link));
  }
}

/** Every `.md` file under `dir`, recursively (absolute paths). */
function walkMd(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkMd(abs));
    else if (entry.name.endsWith('.md')) out.push(abs);
  }
  return out;
}

/**
 * Give every generated page a package-qualified frontmatter title, so the same
 * symbol re-exported by more than one package (e.g. `resolveCapabilities` in both
 * core and ui) does not produce two pages with an identical `<title>`. The title
 * is derived from the page's H1 plus the package name — deterministic, and unique
 * across the whole reference.
 */
function qualifyTitles() {
  for (const pkg of PACKAGES) {
    for (const file of walkMd(join(apiDir, pkg.name))) {
      const md = readFileSync(file, 'utf8');
      if (md.startsWith('---\n')) continue; // already has frontmatter
      const h1 = /^#\s+(.+?)\s*$/m.exec(md);
      if (!h1) continue;
      // TypeDoc backslash-escapes markdown punctuation in headings (`AMBIGUOUS\_PROBE`,
      // `DeepPartial\<T\>`); undo that for a clean plain-text title. JSON.stringify then
      // yields a valid YAML double-quoted scalar (handles any remaining quote/escape).
      const title = `${h1[1]} · ${pkg.name}`.replace(/\\([^A-Za-z0-9])/g, '$1');
      writeFileSync(file, `---\ntitle: ${JSON.stringify(title)}\n---\n\n${md}`);
    }
  }
}

const bin = typedocBin();
for (const pkg of PACKAGES) generate(bin, pkg);
injectBackLinks();
qualifyTitles();
mergeSidebars();
