# 03-01 · Workspace & VitePress Configuration

> **Document**: 03-01-workspace-and-vitepress.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-01 Must-Haves 1, 5, 6 (workspace, IA/nav, search, code-UX, SEO, CSP)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

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
  **`vp:build: vitepress build`** (deliberately **not** named `build` — see the isolation note),
  `preview: vitepress preview`. VitePress (latest stable **1.x**) as a **devDependency of this
  package only**. No `dependencies` (nothing shipped). It defines **no** `build`/`check:deps`/`test`/
  `typecheck` scripts, so `turbo run build/test/typecheck/check:deps` (and thus `yarn verify`) skip it
  entirely — turbo only runs a task in a package that declares it (PF-001, PF-008).
- Root scripts (add to root `package.json`): `"docs:dev": "yarn workspace @jsvision/docs-site dev"`,
  `"docs:build": "yarn workspace @jsvision/docs-site vp:build"`.
- **No `turbo.json` change** (PF-001): a `pkg#task` config entry would **not** exclude a `build`-named
  script from `turbo run build` — it only configures that task. Isolation (AR-3) is achieved by
  **not naming the script `build`**; the site builds only via `yarn docs:build` (→ the workspace's
  `vp:build`) and the docs CI job.

## VitePress config essentials

- `base: process.env.DOCS_BASE ?? '/jsvision/'` (AR-7) — every asset URL is prefixed (ST-1).
  Production builds with `/jsvision/`; the **PR-preview build sets `DOCS_BASE=/jsvision/pr-preview/pr-<N>/`**
  so a preview's absolute asset/page-data URLs resolve under its own subpath, not production's (PF-002).
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

> **VitePress inline scripts (PF-003):** VitePress injects an inline appearance/hydration `<script>`;
> a bare `script-src 'self'` blocks it (a CSP console violation + a theme flash). A Phase-4 validation
> task loads the **built** site, asserts **zero CSP violations**, and adds the SHA-256 **hashes** of
> VitePress's inline scripts to `script-src` — keeping the policy strict (no `'unsafe-inline'` for
> scripts) and honest with the Security page's claim.

## Theme / branding

Extend `DefaultTheme` in `theme/index.ts`; brand colors via CSS custom properties in `custom.css`
for **both** color schemes (contrast ≥ 4.5:1 body text, ST-7). No bespoke layout components in
RD-01 (RD-04 adds hero slots).

## Isolation guarantee

VitePress + plugins are devDependencies of `packages/docs-site` only; they never enter
`@jsvision/core`/`ui`/`files`/`web` dependency graphs → `yarn check:deps` stays green (ST-13).
