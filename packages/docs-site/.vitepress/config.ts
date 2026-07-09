import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type HeadConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const BASE = process.env.DOCS_BASE ?? '/jsvision/';

// The shipped version, injected into the client bundle as __JSVISION_VERSION__ so the demo
// shell's About box always matches the monorepo root package.json.
const ROOT_VERSION = (
  JSON.parse(readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8')) as {
    version: string;
  }
).version;

// Canonical production origin — used for absolute SEO URLs (og:url, canonical,
// sitemap, og:image) regardless of which base a given build is served under, so
// PR-preview builds still advertise the stable production URLs to crawlers.
const SITE_URL = 'https://blendsdk.github.io/jsvision/';
const OG_IMAGE = `${SITE_URL}og-placeholder.png`;
const DEFAULT_DESCRIPTION = 'A TypeScript SDK for building classic terminal (TUI) applications.';

const GITHUB_URL = 'https://github.com/blendsdk/jsvision';
const NPM_URL = 'https://www.npmjs.com/package/@jsvision/core';

// npm has no built-in VitePress social icon, so supply the mark as inline SVG.
const NPM_ICON =
  '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.087 19.2H5.113z"/></svg>';

/** Map a source path (`guide/index.md`) to its served route (`guide/`). */
function routeOf(relativePath: string): string {
  if (relativePath.endsWith('index.md')) return relativePath.slice(0, -'index.md'.length);
  return relativePath.replace(/\.md$/, '.html');
}

/**
 * SHA-256 CSP source expressions for every inline `<script>` (no `src`) in a
 * page's HTML. Computed per build so the policy always matches the real inline
 * scripts VitePress emitted — including the content-dependent hash-map script.
 */
function inlineScriptHashes(html: string): string[] {
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/i.test(m[1]))
    .map((m) => m[2])
    .filter((body) => body.trim().length > 0)
    .map((body) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
  return [...new Set(hashes)];
}

/**
 * Phase-A Content-Security-Policy. Strict: no `unsafe-eval`, and no
 * `'unsafe-inline'` for scripts — every inline script is admitted by its hash.
 * `style-src` keeps `'unsafe-inline'` because VitePress injects inline styles.
 */
function contentSecurityPolicy(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' ${scriptHashes.join(' ')}`.trim(),
    "connect-src 'self'",
    "font-src 'self'",
    "frame-src 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

/**
 * VitePress site configuration for the JSVision documentation website.
 *
 * The `base` is read from `DOCS_BASE` so the same build can be published under
 * different roots: production serves from `/jsvision/` (the GitHub Pages project
 * subpath), while a per-PR preview serves from `/jsvision/pr-preview/pr-<N>/`.
 * VitePress bakes `base` into absolute asset and page-data URLs, so a preview
 * must be built with its own subpath or it would load production assets.
 */
export default withMermaid(
  defineConfig({
    base: BASE,
    vite: {
      define: {
        // Build-time constant for the demo shell's About box.
        __JSVISION_VERSION__: JSON.stringify(ROOT_VERSION),
        // The engine's dev-warning gate reads process.env.NODE_ENV; pin it for the browser bundle.
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      resolve: {
        // The only two Node built-ins in the @jsvision/core graph (the native tty host + the logger's
        // file sink) — aliased to throwing browser stubs the live demos never call.
        alias: {
          'node:fs': '@jsvision/web/browser-stubs',
          'node:tty': '@jsvision/web/browser-stubs',
        },
      },
    },
    lang: 'en-US',
    title: 'JSVision',
    description: DEFAULT_DESCRIPTION,
    sitemap: { hostname: SITE_URL },
    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: `${BASE}favicon.svg` }],
      ['meta', { name: 'theme-color', content: '#0e7490' }],
    ],
    themeConfig: {
      // Client-side search — the index is baked into the build; no external service.
      search: { provider: 'local' },
      nav: [
        { text: 'Guide', link: '/guide/', activeMatch: '^/guide/' },
        { text: 'Components', link: '/components/', activeMatch: '^/components/' },
        { text: 'Apps', link: '/apps/', activeMatch: '^/apps/' },
        { text: 'API', link: '/api/', activeMatch: '^/api/' },
        { text: 'Reference', link: '/reference/', activeMatch: '^/reference/' },
      ],
      // One sidebar per section. Every link targets an existing page (no dead
      // links); the trees fill out as later milestones add content.
      sidebar: {
        '/guide/': [{ text: 'Guide', items: [{ text: 'Introduction', link: '/guide/' }] }],
        '/components/': [
          { text: 'Components', items: [{ text: 'Overview', link: '/components/' }] },
          { text: 'Controls', items: [{ text: 'Button', link: '/components/controls/button' }] },
          { text: 'Files', items: [{ text: 'File dialog', link: '/components/files/file-dialog' }] },
        ],
        '/apps/': [{ text: 'Apps', items: [{ text: 'Overview', link: '/apps/' }] }],
        '/api/': [{ text: 'API Reference', items: [{ text: 'Overview', link: '/api/' }] }],
        '/reference/': [
          { text: 'Reference', items: [{ text: 'Overview', link: '/reference/' }] },
          {
            text: 'Architecture',
            items: [
              { text: 'Overview', link: '/reference/architecture/' },
              { text: 'System Overview', link: '/reference/architecture/system-overview' },
              { text: 'API Design', link: '/reference/architecture/api-design' },
              { text: 'Security', link: '/reference/architecture/security' },
            ],
          },
          {
            text: 'Decisions (ADRs)',
            items: [
              { text: 'Decision Log', link: '/reference/decisions/' },
              { text: 'ADR-001: ESM-only, zero deps', link: '/reference/decisions/ADR-001-esm-zero-dependency' },
              { text: 'ADR-002: Capability auto-config', link: '/reference/decisions/ADR-002-capability-auto-config' },
              {
                text: 'ADR-003: Pure core, injectable seams',
                link: '/reference/decisions/ADR-003-pure-core-injectable-seams',
              },
              { text: 'ADR-004: No node-pty', link: '/reference/decisions/ADR-004-no-node-pty' },
              { text: 'ADR-005: Sanitize boundary', link: '/reference/decisions/ADR-005-sanitize-boundary' },
              {
                text: 'ADR-006: Informational perf bench',
                link: '/reference/decisions/ADR-006-informational-perf-bench',
              },
              { text: 'ADR-007: Monorepo restructure', link: '/reference/decisions/ADR-007-monorepo-restructure' },
              { text: 'ADR-008: Layout engine', link: '/reference/decisions/ADR-008-layout-engine' },
              { text: 'ADR-009: Bun runtime support', link: '/reference/decisions/ADR-009-bun-runtime-support' },
            ],
          },
          {
            text: 'Guides',
            items: [
              { text: 'Getting Started', link: '/reference/guides/getting-started' },
              { text: 'Development', link: '/reference/guides/development' },
            ],
          },
        ],
      },
      socialLinks: [
        { icon: 'github', link: GITHUB_URL },
        { icon: { svg: NPM_ICON }, link: NPM_URL, ariaLabel: 'npm' },
      ],
      editLink: {
        pattern: `${GITHUB_URL}/edit/master/packages/docs-site/:path`,
        text: 'Edit this page on GitHub',
      },
    },
    // Per-page Open Graph + Twitter card metadata for link previews and SEO.
    transformHead({ pageData }) {
      const url = `${SITE_URL}${routeOf(pageData.relativePath)}`;
      const title = pageData.title || 'JSVision';
      const description = pageData.description || pageData.frontmatter?.description || DEFAULT_DESCRIPTION;
      const head: HeadConfig[] = [
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:site_name', content: 'JSVision' }],
        ['meta', { property: 'og:title', content: title }],
        ['meta', { property: 'og:description', content: description }],
        ['meta', { property: 'og:image', content: OG_IMAGE }],
        ['meta', { property: 'og:url', content: url }],
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:title', content: title }],
        ['meta', { name: 'twitter:description', content: description }],
        ['meta', { name: 'twitter:image', content: OG_IMAGE }],
        ['link', { rel: 'canonical', href: url }],
      ];
      return head;
    },
    // Inject the meta-CSP as the first thing in <head> so it governs the inline
    // scripts that follow, with each inline script admitted by its own hash.
    transformHtml(code) {
      const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(inlineScriptHashes(code))}">`;
      return code.replace('<head>', `<head>${meta}`);
    },
  }),
);
