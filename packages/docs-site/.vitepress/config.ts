import { defineConfig } from 'vitepress';

const GITHUB_URL = 'https://github.com/blendsdk/jsvision';
const NPM_URL = 'https://www.npmjs.com/package/@jsvision/core';

// npm has no built-in VitePress social icon, so supply the mark as inline SVG.
const NPM_ICON =
  '<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.087 19.2H5.113z"/></svg>';

/**
 * VitePress site configuration for the JSVision documentation website.
 *
 * The `base` is read from `DOCS_BASE` so the same build can be published under
 * different roots: production serves from `/jsvision/` (the GitHub Pages project
 * subpath), while a per-PR preview serves from `/jsvision/pr-preview/pr-<N>/`.
 * VitePress bakes `base` into absolute asset and page-data URLs, so a preview
 * must be built with its own subpath or it would load production assets.
 */
export default defineConfig({
  base: process.env.DOCS_BASE ?? '/jsvision/',
  lang: 'en-US',
  title: 'JSVision',
  description: 'A TypeScript SDK for building Turbo Vision-style terminal (TUI) applications.',
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
      '/components/': [{ text: 'Components', items: [{ text: 'Overview', link: '/components/' }] }],
      '/apps/': [{ text: 'Apps', items: [{ text: 'Overview', link: '/apps/' }] }],
      '/api/': [{ text: 'API Reference', items: [{ text: 'Overview', link: '/api/' }] }],
      '/reference/': [{ text: 'Reference', items: [{ text: 'Overview', link: '/reference/' }] }],
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
});
