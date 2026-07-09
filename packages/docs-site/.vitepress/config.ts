import { defineConfig } from 'vitepress';

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
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Components', link: '/components/' },
      { text: 'Apps', link: '/apps/' },
      { text: 'API', link: '/api/' },
      { text: 'Reference', link: '/reference/' },
    ],
  },
});
