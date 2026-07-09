# 03-01 · Workspace & VitePress Configuration

> **Document**: 03-01-workspace-and-vitepress.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-01 Must-Haves 1, 5, 6 (workspace, IA/nav, search, code-UX, SEO, CSP)
> **CodeOps Skills Version**: 3.3.2

## The workspace

`packages/docs-site/`:

```
package.json          # @jsvision/docs-site, private, scripts: dev/build/preview
.vitepress/
  config.ts           # site config: title, base, nav, sidebar, search, head/SEO, markdown, sitemap
  theme/index.ts      # extends DefaultTheme + brand overrides (custom.css)
  theme/custom.css     # brand tokens for light + dark
index.md              # Home (layout: home) — placeholder hero (RD-04 fills it)
guide/index.md        # placeholder
components/index.md    # placeholder
apps/index.md          # placeholder
api/index.md           # placeholder (RD-06 generates into api/)
reference/index.md     # placeholder (RD-08 fills; absorbs docs/ in 03-03)
public/                # favicon.ico, robots.txt, og-placeholder.png, 404 assets
```

- `package.json`: `"private": true`, `"type": "module"`, scripts `dev: vitepress dev`,
  `build: vitepress build`, `preview: vitepress preview`. VitePress (latest stable **1.x**) as a
  **devDependency of this package only**. No `dependencies` (nothing shipped).
- Root scripts (add to root `package.json`): `"docs:dev": "yarn workspace @jsvision/docs-site dev"`,
  `"docs:build": "yarn workspace @jsvision/docs-site build"`.
- `turbo.json`: add `docs-site#build` with `"outputs": [".vitepress/dist/**"]` and no `dependsOn`
  (RD-01 has no cross-package build input). It is **not** in the default `build` fan-out that
  `yarn verify` runs (AR-3) — invoked only by `yarn docs:build` and the docs CI job.

## VitePress config essentials

- `base: '/jsvision/'` (AR-7) — every asset URL is prefixed (ST-1).
- `title`, `description`, `lang: 'en-US'`.
- `themeConfig.nav` + `themeConfig.sidebar` = the IA skeleton (Home · Guide · Components · Apps · API
  · Reference) with placeholder routes so there are **no dead links** (ST-4). Social links: GitHub, npm.
- `themeConfig.search: { provider: 'local' }` (AR-8) — client-side, no external service (ST-5).
- Dark/light: default VitePress `appearance` (toggle in the nav).
- Markdown: Shiki TS highlighting is the VitePress default; the copy-code button is on by default
  (`config.markdown` may pin a theme for light/dark). No extra config needed beyond confirming ST-6.

## SEO surface

- `head`: `<meta name="description">` per page (VitePress `frontmatter.description` + a
  `transformHead`/`transformPageData` hook to emit `og:title`/`og:description`/`og:image` +
  `twitter:card`). OG image = `public/og-placeholder.png` (AR-11), replaced by RD-09.
- `sitemap: { hostname: 'https://blendsdk.github.io/jsvision/' }` (VitePress built-in) → `sitemap.xml`.
- `public/robots.txt` (allow all + sitemap link), `public/favicon.ico`, and a custom `404.md`.

## Content-Security-Policy (AR-9)

GitHub Pages cannot set response headers, so deliver CSP via `<meta http-equiv="Content-Security-Policy">`
in `head`. Phase-A policy (tighten as features land):

```
default-src 'self';
img-src 'self' data:;
style-src 'self' 'unsafe-inline';        /* VitePress injects some inline styles */
script-src 'self';                        /* VitePress ships hashed module scripts */
connect-src 'self';
font-src 'self';
frame-src 'none';
base-uri 'self';
object-src 'none'
```

No `unsafe-eval` on content pages (ST-9). The later live-demo/REPL sandbox (RD-03/RD-08) will scope
any relaxation to an isolated worker/iframe context — out of scope here.

## Theme / branding

Extend `DefaultTheme` in `theme/index.ts`; brand colors via CSS custom properties in `custom.css`
for **both** color schemes (contrast ≥ 4.5:1 body text, ST-7). No bespoke layout components in
RD-01 (RD-04 adds hero slots).

## Isolation guarantee

VitePress + plugins are devDependencies of `packages/docs-site` only; they never enter
`@jsvision/core`/`ui`/`files`/`web` dependency graphs → `yarn check:deps` stays green (ST-13).
