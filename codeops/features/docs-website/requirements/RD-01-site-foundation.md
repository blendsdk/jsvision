# RD-01: Site Foundation & Delivery Pipeline

> **Document**: RD-01-site-foundation.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: — (foundation RD for this feature-set)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

---

## Feature Overview

Stand up the documentation website as a new Turborepo workspace, `packages/docs-site`, built with
**VitePress**, and deliver it to **GitHub Pages** through GitHub Actions with a production deploy on
merge and a **preview deploy per pull request**. This RD owns everything structural and
cross-cutting that every later content RD sits on: the information architecture and navigation, the
brand/theme, local search, dark/light mode, code-block ergonomics (copy button, TypeScript
highlighting via Shiki), and the SEO surface (meta tags, Open Graph, sitemap, 404). It does **not**
author component/marketing content (RD-04, RD-05, RD-08) or wire live demos (RD-03) — it provides
the shell those slot into.

The existing repo-root `docs/` (a VitePress-shaped set of architecture notes, ADRs, and guides that
was authored but never built) is **absorbed** into the new site as the seed of its Architecture/ADR
section, so the project has exactly one documentation site.

---

## Functional Requirements

### Must Have

- [ ] A new private workspace `packages/docs-site` (`@jsvision/docs-site`, `private: true`) running
      VitePress, wired into `yarn` workspaces and `turbo.json` (`dev`, `build`, `check:docs` as
      applicable); `yarn docs:dev` and `yarn docs:build` run from the repo root.
- [ ] The production build outputs a static site under `packages/docs-site/.vitepress/dist` with
      `base: '/jsvision/'`, deployable to `https://blendsdk.github.io/jsvision/`.
- [ ] A GitHub Actions workflow builds and deploys the site to GitHub Pages on every push to
      `master` that touches site inputs, using the official Pages deploy action and `GITHUB_TOKEN`
      with `pages: write` + `id-token: write` (no long-lived secret).
- [ ] A **per-PR preview**: each pull request that touches site inputs produces a reviewable
      preview build (a deployed preview URL or a downloadable built artifact) so a reviewer can test
      the slice before merge.
- [ ] Information architecture: a top navigation and a sidebar covering the section skeleton — Home,
      Guide (Getting Started, Core Concepts), Components, Sample Apps, API, Reference (Architecture,
      FAQ, Best Practices), and external links (GitHub, npm). Later RDs fill the pages; RD-01 defines
      the tree and the config that renders it.
- [ ] **VitePress local search** enabled (client-side, no external service).
- [ ] Dark/light theme toggle (VitePress default), with the site's brand colors applied in both.
- [ ] Code blocks: TypeScript syntax highlighting (Shiki), a copy-to-clipboard button, and line
      highlighting support.
- [ ] SEO surface: per-page `<title>`/description, Open Graph + Twitter card meta, a generated
      `sitemap.xml`, `robots.txt`, a favicon, and a branded 404 page.
- [ ] The existing root `docs/` content (architecture/, decisions/, guides/, acceptance-gate.md,
      index.md) is migrated into the new site's structure (or referenced from it) and renders; no
      authored techdocs content is lost.

### Should Have

- [ ] A homepage layout scaffold (VitePress `layout: home` hero slots) that RD-04 populates — RD-01
      wires the layout and a placeholder so the route exists.
- [ ] An announcement/banner slot for the pre-1.0 "API may change" notice (content owned by RD-08).
- [ ] `lastUpdated` timestamps and an "Edit this page" link to the GitHub source per page.
- [ ] A redirect map so the old `docs/` deep links (if any are published) resolve.

### Won't Have (Out of Scope)

- Live demos / the Play button / xterm integration — RD-03.
- Marketing/landing copy and Core Concepts pages — RD-04.
- Component pages and the API reference — RD-05, RD-06.
- The `check:docs-site` parity gate and screenshot automation — RD-09.
- Versioned docs / a version switcher — deferred (AR-18).

---

## Technical Requirements

### Workspace & build

- `packages/docs-site/` layout: `package.json` (private), `.vitepress/config.ts` (site config +
  nav/sidebar + search + head/SEO), `.vitepress/theme/` (brand overrides, extends the default
  theme), and content directories (`guide/`, `components/`, `apps/`, `api/`, `reference/`, `public/`).
- VitePress and its build toolchain are **devDependencies of `docs-site` only**; they must not enter
  any published package's dependency graph (the zero-runtime-dep guarantee of `@jsvision/core`/`ui`
  is unaffected). `yarn check:deps` continues to pass for the shipped packages.
- `turbo.json`: add `docs-site#build` (no `dependsOn` beyond what live demos later need) and a
  `docs-site#dev` passthrough; the site build is excluded from the packages' `test`/`typecheck`
  fan-out unless a task explicitly targets it.

### Deploy pipeline

| Concern | Choice |
|---------|--------|
| Host | GitHub Pages (project site), `base: '/jsvision/'` |
| Build | GitHub Actions: `yarn install --frozen-lockfile` → build core/ui (live demos need `dist`) → `yarn docs:build` → upload Pages artifact → deploy |
| Prod trigger | push to `master` affecting site inputs (`packages/docs-site/**`, `packages/{core,ui,files,web}/**`, workflow file) |
| PR preview | on `pull_request`: build + publish a preview (preview environment or uploaded artifact); comment the preview URL on the PR |
| Concurrency | one in-flight Pages deploy (`concurrency: pages`), cancel superseded prod runs |

### Information architecture (nav/sidebar skeleton)

```
Home
Guide/        → Getting Started · Core Concepts        (content: RD-04)
Components/   → Overview · <per component>             (content: RD-05)
Apps/         → Todo · tvedit · Kitchen-Sink · Files   (content: RD-07)
API/          → generated reference                    (content: RD-06)
Reference/    → Architecture · Best Practices · FAQ · Accessibility · Security · Performance · Compatibility · Contributing · Changelog · Roadmap   (content: RD-08)
```

---

## Integration Points

### With RD-02 (`@jsvision/web`) & RD-03 (live-example system)
- The site build depends on `@jsvision/core`/`@jsvision/ui`/`@jsvision/web` `dist` being present; the
  CI build order and `turbo` `dependsOn` are defined here so RD-03's live demos bundle correctly.

### With RD-06 (API reference)
- RD-06 emits markdown into an `api/` content dir that this RD's sidebar/nav already routes to.

### With RD-09 (anti-drift)
- The `check:docs-site` gate and Playwright screenshots run in the CI workflow scaffolded here; RD-09
  adds the jobs, RD-01 provides the workflow they extend.

### With RD-08 (reference & trust)
- The absorbed `docs/` techdocs become RD-08's Architecture/ADR pages; RD-01 places them, RD-08
  updates/expands them.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Static-site generator | VitePress / Docusaurus / Astro | VitePress | User-specified; Vite-native (matches the live-demo bundler); light, fast, Vue-component escape hatch for the Play button | AR-28 |
| Site location | `packages/docs-site` / root `docs/` / two sites | New `packages/docs-site`, absorb `docs/` | Workspace can import + bundle the live-demo packages; one site/search/theme | AR-23 |
| Deploy target | GitHub Pages / Cloudflare / Vercel-Netlify | GitHub Pages + PR previews | No new vendor; matches the repo; per-PR test slices | AR-4 |
| URL / base path | Project subpath / custom domain | Subpath `base:'/jsvision/'` | Zero DNS; immediate | AR-8 |
| Search | VitePress local / Algolia | VitePress local | No external service/approval; ample for the page count | AR-12 |

---

## Security Considerations

> **🚨 MANDATORY section.** This is a static site with **no server, no auth, no database**, so
> classic web-app threats (SQL injection, authz, session management, server-side rate limiting) are
> **N/A**. The real surfaces are content injection, the browser security policy, and the build
> supply chain.

- **Data sensitivity**: none — no user accounts, no PII, no secrets in the client bundle.
- **Input validation**: RD-01 renders only authored markdown; any dynamic/interactive input arrives
  with RD-03 (live demos) and RD-08 (playground later) and is handled there.
- **Authentication & authorization**: N/A (public read-only site). GitHub Pages deploy uses the
  ephemeral `GITHUB_TOKEN` scoped to `pages: write`/`id-token: write`; **no long-lived deploy
  secret** is stored.
- **Injection risks**: a strict **Content-Security-Policy** is delivered via a `<meta>` CSP (GitHub
  Pages cannot set response headers) restricting script/style/connect/img sources; inline scripts are
  avoided except VitePress's own hashed bundles. Full CSP hardening and the sandboxing of any future
  in-browser code execution are specified in RD-10/RD-03/RD-08 (AR-26).
- **Encryption**: HTTPS is enforced by GitHub Pages (`Enforce HTTPS`).
- **Rate limiting**: N/A (static CDN).
- **Infrastructure**: build dependencies are pinned via `yarn.lock` and covered by `npm audit` in
  CI; docs-site devDependencies never enter a shipped package's dependency graph.

---

## Acceptance Criteria

1. [ ] `yarn docs:build` from the repo root exits 0 and produces `packages/docs-site/.vitepress/dist/index.html`
       whose asset URLs are all prefixed with `/jsvision/` (verifying `base`).
2. [ ] Merging to `master` a change under `packages/docs-site/**` results in the GitHub Actions
       "Deploy docs" workflow completing successfully and the site being reachable at
       `https://blendsdk.github.io/jsvision/` (HTTP 200, correct `<title>`).
3. [ ] Opening a pull request that edits a site page produces a preview (a preview URL commented on
       the PR, or a downloadable `docs-site-dist` artifact attached to the run) built from that PR's
       HEAD — verified by a visible change appearing only in the preview, not on production.
4. [ ] The rendered site shows a working top-nav + sidebar matching the IA skeleton above; every
       skeleton section resolves to a route (placeholder pages allowed) with **no dead links**
       (a link-check step passes).
5. [ ] Typing a known term (e.g. "Button") into the search box returns at least one result from the
       local index without any network request to a third-party host (verified in the network panel).
6. [ ] Toggling the theme switches the whole site between light and dark; brand colors are legible
       (contrast ≥ 4.5:1 for body text) in both modes.
7. [ ] A TypeScript code block renders with syntax highlighting and a copy button that places the
       block's exact text on the clipboard.
8. [ ] `view-source` of any page contains: a unique `<title>`, `og:title`/`og:description`/`og:image`
       meta, and a `<meta http-equiv="Content-Security-Policy">`; `/jsvision/sitemap.xml` and
       `/jsvision/404.html` exist and return content.
9. [ ] Every page previously present under root `docs/` renders somewhere in the new site (a mapping
       table is checked in); no authored techdocs page 404s.
10. [ ] `yarn check:deps` still passes for `@jsvision/core`, `@jsvision/ui`, `@jsvision/files`, and
        `@jsvision/web` — the docs-site toolchain has not leaked a runtime dependency into any of them.
11. [ ] Security requirements verified: the deployed pages carry the meta-CSP; the deploy workflow
        uses only `GITHUB_TOKEN` (no stored secret); `npm audit` runs in CI; HTTPS is enforced.
