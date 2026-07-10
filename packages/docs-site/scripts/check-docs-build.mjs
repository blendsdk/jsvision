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

import { createHash } from 'node:crypto';
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

/**
 * Every former repo-root `docs/` website page, at its new site route. Each must
 * render in `dist` and have a row in `redirects.md` (ST-11). The Technical
 * Architecture landing (`docs/index.md`) folds into `/reference/architecture/`.
 */
const MIGRATED_ROUTES = [
  '/reference/architecture/',
  '/reference/architecture/system-overview',
  '/reference/architecture/api-design',
  '/reference/architecture/security',
  '/reference/decisions/',
  '/reference/decisions/ADR-001-esm-zero-dependency',
  '/reference/decisions/ADR-002-capability-auto-config',
  '/reference/decisions/ADR-003-pure-core-injectable-seams',
  '/reference/decisions/ADR-004-no-node-pty',
  '/reference/decisions/ADR-005-sanitize-boundary',
  '/reference/decisions/ADR-006-informational-perf-bench',
  '/reference/decisions/ADR-007-monorepo-restructure',
  '/reference/decisions/ADR-008-layout-engine',
  '/reference/decisions/ADR-009-bun-runtime-support',
  '/reference/guides/getting-started',
  '/reference/guides/development',
];

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

/** Every `<a href="…">` target on a page. */
function anchorHrefs(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1]);
}

/**
 * Collapse a dist-relative path or an internal link into one canonical key, so
 * a page and every URL form that reaches it compare equal: `guide/index.html`,
 * `guide/`, `guide`, and `guide.html` all key to `guide` (and the homepage to '').
 */
function pageKey(relPath) {
  return relPath
    .replace(/index\.html$/, '')
    .replace(/\/$/, '')
    .replace(/\.html$/, '');
}

/**
 * Resolve an internal `<a>` link on `fromPage` to its canonical page key, or
 * null when the link is external, an anchor, or a non-page asset. Absolute
 * links must sit under BASE; relative links resolve against the page's folder.
 */
function resolveInternalLink(href, fromPage) {
  const path = href.split('#')[0].split('?')[0];
  if (!path) return null; // pure anchor / empty
  if (/^(?:[a-z]+:|\/\/)/i.test(path)) return null; // http:, mailto:, //host
  if (/\.(?:js|css|png|svg|ico|woff2?|json|xml|txt|webp|jpg|jpeg|gif)$/i.test(path)) return null;

  let rel;
  if (path.startsWith(BASE)) {
    rel = path.slice(BASE.length);
  } else if (path.startsWith('/')) {
    return null; // root-absolute but outside BASE — not a dist page
  } else {
    const dir = fromPage.includes('/') ? fromPage.replace(/\/[^/]*$/, '') : '';
    rel = join(dir, path).split('\\').join('/');
  }
  return pageKey(rel);
}

// --- colour / WCAG contrast helpers ---------------------------------------

/** Parse `#rgb` or `#rrggbb` into `[r, g, b]` (0–255); throws on anything else. */
function hexToRgb(hex) {
  const h = hex.trim().replace(/^#/, '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** WCAG relative luminance of an sRGB colour. */
function relativeLuminance([r, g, b]) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two hex colours (1–21). */
function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexToRgb(hexA));
  const lb = relativeLuminance(hexToRgb(hexB));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Capture the declarations inside the first `selector { … }` rule, or ''. */
function cssBlock(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`${esc}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[1] : '';
}

/** Read a `--custom-property` value from a CSS declaration block, or null. */
function cssToken(block, name) {
  const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block);
  return m ? m[1].trim() : null;
}

/** Bodies of every inline `<script>` (no `src`) on a page — the CSP-hashable code. */
function inlineScripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/i.test(m[1]))
    .map((m) => m[2]);
}

/** The `'sha256-…'` CSP source expression for an inline script body. */
function scriptHash(body) {
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
}

/** Return the value of a `<meta ... {keyAttr}="{keyVal}" ... content="…">` tag, or null. */
function metaContent(html, keyAttr, keyVal) {
  for (const m of html.matchAll(/<meta\b[^>]*>/g)) {
    const tag = m[0];
    if (tag.includes(`${keyAttr}="${keyVal}"`)) {
      const c = /content="([^"]*)"/.exec(tag);
      if (c) return c[1];
    }
  }
  return null;
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

// --- ST-4: no dead internal links + nav skeleton --------------------------

check('ST-4', 'No dead internal links + nav skeleton present', () => {
  const pages = htmlPages();
  const keys = new Set(pages.map(pageKey));

  const broken = [];
  for (const page of pages) {
    const html = readFileSync(join(distDir, page), 'utf8');
    for (const href of anchorHrefs(html)) {
      const key = resolveInternalLink(href, page);
      if (key === null) continue;
      if (!keys.has(key)) broken.push(`${page} → ${href}`);
    }
  }
  if (broken.length) {
    fail(`${broken.length} broken internal link(s):\n    ${broken.slice(0, 10).join('\n    ')}`);
  }

  // The nav renders on every page, so the homepage must link to each section.
  const home = readFileSync(join(distDir, 'index.html'), 'utf8');
  const sections = ['guide', 'components', 'apps', 'api', 'reference'];
  const missing = sections.filter((s) => !new RegExp(`href="${BASE}${s}/?(?:index\\.html)?"`).test(home));
  if (missing.length) fail(`nav skeleton missing links: ${missing.join(', ')}`);

  return `${pages.length} pages, 0 broken links; nav skeleton present`;
});

// --- ST-5: local search index is emitted (no third-party search) ----------

check('ST-5', 'Local search index emitted (client-side, no external service)', () => {
  const indexChunks = walk(distDir)
    .map((f) => relative(distDir, f))
    .filter((f) => /localSearchIndex/i.test(f));
  if (!indexChunks.length) fail('no local search index chunk in dist (expected an @localSearchIndex* asset)');
  return `local search index present (${indexChunks.length} chunk(s))`;
});

// --- ST-6: TS code block renders with Shiki highlight + copy button --------

check('ST-6', 'A TS code block renders with Shiki markup and a copy button', () => {
  const hit = htmlPages().find((page) => {
    const html = readFileSync(join(distDir, page), 'utf8');
    return /language-ts\b/.test(html) && /(class="copy"|title="Copy Code")/.test(html);
  });
  if (!hit) fail('no page with a Shiki `language-ts` block plus a copy button');
  return `Shiki TS highlight + copy button on ${hit}`;
});

// --- MERMAID: fenced ```mermaid diagrams become diagrams, not code blocks ---

check('MERMAID', '```mermaid fences render as diagrams (mermaid plugin active)', () => {
  const pages = htmlPages();
  // A regression would leave the fence as a highlighted code block.
  const rawFallback = pages.find((page) => /language-mermaid\b/.test(readFileSync(join(distDir, page), 'utf8')));
  if (rawFallback) fail(`\`\`\`mermaid fell back to a code block on ${rawFallback} (mermaid plugin not active)`);

  const withDiagram = pages.find((page) => /class="mermaid"/.test(readFileSync(join(distDir, page), 'utf8')));
  if (!withDiagram) fail('no rendered mermaid diagram container found (expected on the Architecture page)');
  return `mermaid diagram container on ${withDiagram}; no raw fallbacks`;
});

// --- ST-7: both colour schemes defined + body contrast ≥ 4.5:1 ------------

check('ST-7', 'Light + dark schemes defined; body-text contrast ≥ 4.5:1 in each', () => {
  const cssPath = join(siteRoot, '.vitepress', 'theme', 'custom.css');
  if (!existsSync(cssPath)) fail('theme/custom.css is missing');
  const css = readFileSync(cssPath, 'utf8');

  const blocks = { light: cssBlock(css, ':root'), dark: cssBlock(css, '.dark') };
  if (!blocks.light) fail('no `:root` (light) token block');
  if (!blocks.dark) fail('no `.dark` token block');

  for (const [scheme, block] of Object.entries(blocks)) {
    const bg = cssToken(block, '--vp-c-bg');
    const fg = cssToken(block, '--vp-c-text-1');
    if (!bg || !fg) fail(`${scheme}: missing --vp-c-bg or --vp-c-text-1`);
    const ratio = contrastRatio(bg, fg);
    if (ratio < 4.5) fail(`${scheme} body contrast ${ratio.toFixed(2)}:1 < 4.5:1 (${fg} on ${bg})`);
  }
  return 'both schemes defined; body-text contrast ≥ 4.5:1';
});

// --- ST-8: per-page SEO meta ----------------------------------------------

check('ST-8', 'Unique <title> + og:title/description/image + twitter:card per page', () => {
  const pages = htmlPages();
  const seenTitles = new Map();
  const problems = [];

  for (const page of pages) {
    const html = readFileSync(join(distDir, page), 'utf8');

    const title = (/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '').trim();
    if (!title) problems.push(`${page}: no <title>`);
    else if (seenTitles.has(title)) problems.push(`${page}: <title> "${title}" duplicates ${seenTitles.get(title)}`);
    else seenTitles.set(title, page);

    for (const [attr, val] of [
      ['property', 'og:title'],
      ['property', 'og:description'],
      ['property', 'og:image'],
      ['name', 'twitter:card'],
    ]) {
      if (!metaContent(html, attr, val)) problems.push(`${page}: missing ${val}`);
    }
  }
  if (problems.length) fail(`${problems.length} SEO issue(s):\n    ${problems.slice(0, 10).join('\n    ')}`);
  return `${pages.length} pages: unique titles + og:* + twitter:card`;
});

// --- ST-9: meta CSP present, safe, and honestly enforced ------------------

check('ST-9', 'Meta CSP on every page: no unsafe-eval, strict script-src hashes all inline scripts', () => {
  const problems = [];
  for (const page of htmlPages()) {
    const html = readFileSync(join(distDir, page), 'utf8');
    const csp = metaContent(html, 'http-equiv', 'Content-Security-Policy');
    if (!csp) {
      problems.push(`${page}: no <meta http-equiv="Content-Security-Policy">`);
      continue;
    }
    if (/unsafe-eval/.test(csp)) problems.push(`${page}: CSP allows unsafe-eval`);

    const scriptSrc = /script-src\b([^;]*)/.exec(csp)?.[1] ?? '';
    if (/'unsafe-inline'/.test(scriptSrc)) problems.push(`${page}: script-src allows 'unsafe-inline'`);

    // Every inline script VitePress emits must be covered by a hash, or the
    // strict policy would block it at runtime (the PF-003 concern).
    for (const body of inlineScripts(html)) {
      if (!body.trim()) continue;
      const hash = scriptHash(body);
      if (!scriptSrc.includes(hash))
        problems.push(`${page}: inline script not hashed in script-src (${hash.slice(0, 24)}…)`);
    }
  }
  if (problems.length) fail(`${problems.length} CSP issue(s):\n    ${problems.slice(0, 10).join('\n    ')}`);
  return 'meta CSP present; no unsafe-eval; strict script-src hashes every inline script';
});

// --- ST-10: static SEO assets ---------------------------------------------

check('ST-10', 'Static SEO assets present (sitemap.xml, robots.txt, favicon, 404.html)', () => {
  const missing = ['sitemap.xml', 'robots.txt', '404.html'].filter((f) => !existsSync(join(distDir, f)));
  if (!['favicon.ico', 'favicon.svg'].some((f) => existsSync(join(distDir, f)))) missing.push('favicon.ico/svg');
  if (missing.length) fail(`missing static asset(s): ${missing.join(', ')}`);
  return 'sitemap.xml, robots.txt, favicon, 404.html all present';
});

// --- ST-11: docs/ migration completeness ----------------------------------

check('ST-11', 'Every former docs/ page renders in dist and has a redirects.md row', () => {
  const redirectsPath = join(siteRoot, 'redirects.md');
  if (!existsSync(redirectsPath)) fail('redirects.md is missing');
  const redirects = readFileSync(redirectsPath, 'utf8');

  const keys = new Set(htmlPages().map(pageKey));
  const problems = [];
  for (const route of MIGRATED_ROUTES) {
    if (!keys.has(pageKey(route.replace(/^\//, '')))) problems.push(`not rendered in dist: ${route}`);
    if (!redirects.includes(route)) problems.push(`no redirects.md row: ${route}`);
  }
  if (problems.length) fail(`${problems.length} migration gap(s):\n    ${problems.slice(0, 12).join('\n    ')}`);
  return `${MIGRATED_ROUTES.length} migrated pages rendered + mapped in redirects.md`;
});

// --- ST-12: the load-bearing spec-test oracle stays in place --------------

check('ST-12', 'docs/acceptance-gate.md kept in place (spec-test oracle intact)', () => {
  const gate = join(repoRoot, 'docs', 'acceptance-gate.md');
  if (!existsSync(gate)) fail('docs/acceptance-gate.md was moved/removed — it is the gate.spec oracle and must stay');
  if (readFileSync(gate, 'utf8').trim().length === 0) fail('docs/acceptance-gate.md is empty');
  return 'docs/acceptance-gate.md present (gate.spec oracle preserved)';
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

// --- LIVE-EXAMPLES: every showcase page runs its example live -------------

check('LIVE-EXAMPLES', 'Every live-example page mounts a labelled Play component', () => {
  // A live-example page carries the server-rendered Play component wrapper. Find
  // them by that marker, then confirm each survived the production build with a
  // real, ARIA-labelled Play button. The showcase pages run the example live and
  // intentionally do not embed its source — readers follow the GitHub link.
  const pages = htmlPages().filter((page) =>
    readFileSync(join(distDir, page), 'utf8').includes('class="play-example"'),
  );
  if (pages.length < 8) fail(`expected ≥ 8 live-example pages, found ${pages.length}`);

  const problems = [];
  for (const page of pages) {
    const html = readFileSync(join(distDir, page), 'utf8');
    if (!/aria-label="Run the [^"]+ example in a terminal"/.test(html)) {
      problems.push(`${page}: no ARIA-labelled Play button`);
    }
  }
  if (problems.length) fail(`${problems.length} live-example issue(s):\n    ${problems.join('\n    ')}`);
  return `${pages.length} live-example pages: labelled Play component mounted`;
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
