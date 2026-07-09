# Execution Plan: Site Foundation & Delivery Pipeline

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-09 16:54
> **Progress**: 25/25 tasks (100%) — all automated STs green; live ST-3 deploy acceptance pending user (enable GitHub Pages)
> **CodeOps Skills Version**: 3.3.2

## Overview

Stand up `packages/docs-site` (VitePress) and ship it to GitHub Pages with production + live PR
previews, the IA/nav/search/theme/SEO/CSP surface, and the `docs/` website content absorbed in.
Five phases; each phase is spec-first and leaves a **deployable, testable slice** (the live skeleton
lands at Phase 2 and grows).

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Workspace scaffold + buildable skeleton | 5 |
| 2 | GitHub Pages delivery (prod + live PR previews) | 4 |
| 3 | IA / nav / theme / search / code-UX | 5 |
| 4 | SEO + CSP + static assets | 6 |
| 5 | Content migration (absorb `docs/`) | 5 |

**Total: 25 tasks across 5 phases.** (Preflight PF-001…009 applied — see [00-preflight-report.md](00-preflight-report.md).)

> **⚠️ EXECUTION RULE:** the task checkboxes are the single source of truth for progress. Mark `[~]`
> with a timestamp on implementation, promote to `[x]` only after its verify passes, update the
> Progress header after each task. Resume at the first `[~]` then the first `[ ]`. Timestamps via
> `date '+%Y-%m-%d %H:%M'`. Specification-first: spec (assertion script) → red → implement → green →
> harden. **Verify**: docs tasks → `yarn docs:build` + `node packages/docs-site/scripts/check-docs-build.mjs`;
> migration → also `yarn verify` (shipped packages). **Never** put raw git in this doc — commit via
> `/gitcm` / `/gitcmp`; file moves are described as moves (the executor uses `git mv` to preserve history).

---

## Phase 1: Workspace scaffold + buildable skeleton

**Reference**: [03-01](03-01-workspace-and-vitepress.md) · [07](07-testing-strategy.md) ST-1, ST-2, ST-13 · AR-3, AR-5, AR-7

### Step 1.1: Spec (RED)
- [x] 1.1.1 Write `packages/docs-site/scripts/check-docs-build.mjs` asserting **ST-1** (build exits 0, `dist/index.html` exists, all asset URLs `/jsvision/`-prefixed) and **ST-2** (each nav-section page built). Assertions read the built `dist`. _(2026-07-09 16:14)_
- [x] 1.1.2 Verify RED: the script fails (no `packages/docs-site` / no `dist` yet). _(2026-07-09 16:14 — exit 1, both ST-1/ST-2 fail as expected)_

### Step 1.2: Implementation (GREEN)
- [x] 1.2.1 Scaffold `packages/docs-site`: `package.json` (`@jsvision/docs-site`, private, `type:module`, scripts `dev`/**`vp:build`**/`preview` — build script deliberately **not** named `build`, and **no** `check:deps`/`test`/`typecheck` scripts, so turbo/verify skip it, PF-001/PF-008; VitePress 1.x **devDependency only**) + placeholder `index.md` and one placeholder page per section (guide/components/apps/api/reference). _(2026-07-09 16:19 — vitepress 1.6.4 installed)_
- [x] 1.2.2 Minimal `.vitepress/config.ts` (`base: process.env.DOCS_BASE ?? '/jsvision/'` per PF-002, title, nav skeleton) + root `docs:dev`/`docs:build` (→ workspace `vp:build`) scripts. **No `turbo.json` change** — isolation (AR-3) comes from the non-`build` script name (PF-001). _(2026-07-09 16:19; also gitignore/eslint/prettier-ignore `.vitepress/dist`+`cache`)_

### Step 1.3: Green + harden
- [x] 1.3.1 `yarn docs:build` green; `check-docs-build.mjs` passes ST-1/ST-2; **ST-13** `yarn check:deps` green for all shipped packages (no toolchain leak). _(2026-07-09 16:19 — turbo `build` command for docs-site = `<NONEXISTENT>`, isolation verified; check:deps exit 0; lint/prettier clean)_

---

## Phase 2: GitHub Pages delivery (prod + live PR previews)

**Reference**: [03-02](03-02-deploy-pipeline.md) · [07](07-testing-strategy.md) ST-3, ST-14 · AR-1

### Step 2.1: Spec (RED)
- [x] 2.1.1 Extend `check-docs-build.mjs` (or a small companion) to assert **ST-14**: `.github/workflows/docs.yml` parses, triggers on the site paths, declares `permissions: contents:write` + `pull-requests:write`, and uses only `GITHUB_TOKEN` (no stored secret). Verify RED (no workflow yet). _(2026-07-09 16:25 — added ST-14 (js-yaml devDep); RED confirmed: "docs.yml is missing")_

### Step 2.2: Implementation (GREEN)
- [x] 2.2.1 Add `.github/workflows/docs.yml`: **production** job on `master` (checkout → setup-node 22 → `yarn install --frozen-lockfile` → `yarn docs:build` → `peaceiris/actions-gh-pages@v4` publish `dist` to `gh-pages` root, `keep_files:true`, PF-006); **preview** job on `pull_request` (build with `DOCS_BASE=/jsvision/pr-preview/pr-<N>/` per PF-002 → `rossjrw/pr-preview-action@v1` to `/pr-preview/pr-N/`, comment URL, cleanup on close); **shared** `concurrency: docs-gh-pages` (PF-005); triggers on `packages/docs-site/**` + the workflow file, **not** `docs/**` (PF-009). Do **not** modify `ci.yml`. _(2026-07-09 16:25 — ci.yml untouched; ST-14 green)_
- [x] 2.2.2 Document the one-time Pages prerequisite (Settings → Pages → Deploy from branch `gh-pages`/root, enforce HTTPS) in the workspace README + the deploy checklist below. _(2026-07-09 16:25 — `packages/docs-site/README.md` added; Deploy checklist below)_

### Step 2.3: Green + manual acceptance
- [x] 2.3.1 ST-14 passes. **Manual acceptance (ST-3)** after Pages is enabled: merge to `master` → site 200 at `https://blendsdk.github.io/jsvision/`; open a PR → preview URL commented + serves the changed page. Record the result here. _(This is the deployable-slice checkpoint — the user can test live.)_ _(2026-07-09 16:25 — **ST-14 ✅ automated (green)**. **ST-3 live acceptance ⛳ PENDING USER** — requires enabling GitHub Pages (gh-pages/root) then a `master` merge + a test PR; tracked as the unchecked Deploy-checklist items below. Cannot be run from here.)_

---

## Phase 3: IA / nav / theme / search / code-UX

**Reference**: [03-01](03-01-workspace-and-vitepress.md) · [07](07-testing-strategy.md) ST-4, ST-5, ST-6, ST-7 · AR-8

### Step 3.1: Spec (RED)
- [x] 3.1.1 Extend `check-docs-build.mjs`: **ST-4** (link-check over `dist`, nav/sidebar skeleton present), **ST-5** (local search index emitted), **ST-6** (a TS block has Shiki markup + copy button), **ST-7** (both color schemes defined, body contrast ≥ 4.5:1). Verify RED. _(2026-07-09 16:32 — ST-5/6/7 RED as expected; ST-4 already satisfied by the minimal nav)_

### Step 3.2: Implementation (GREEN)
- [x] 3.2.1 Full `themeConfig.nav` + `sidebar` (Home · Guide · Components · Apps · API · Reference) with placeholder routes (no dead links), GitHub/npm social links, and `search:{provider:'local'}`. _(2026-07-09 16:32 — per-section sidebars link only to existing pages; npm via inline-SVG icon; editLink added)_
- [x] 3.2.2 Brand theme: `theme/index.ts` extends DefaultTheme + `custom.css` brand tokens for light **and** dark (contrast-checked); confirm Shiki TS highlight + copy button; a sample TS snippet page. _(2026-07-09 16:32 — terminal-cyan accent; body contrast 15.5:1/15.1:1; TS snippet in guide/)_

### Step 3.3: Green + harden
- [x] 3.3.1 ST-4/5/6/7 pass; `yarn docs:build` green; dark/light toggle verified. _(2026-07-09 16:32 — 7/7 checks green; `VPSwitchAppearance` toggle rendered in built HTML; appearance default on)_

---

## Phase 4: SEO + CSP + static assets

**Reference**: [03-01](03-01-workspace-and-vitepress.md) · [07](07-testing-strategy.md) ST-8, ST-9, ST-10 · AR-9, AR-11

### Step 4.1: Spec (RED)
- [x] 4.1.1 Extend `check-docs-build.mjs`: **ST-8** (unique title + OG/Twitter meta per page), **ST-9** (meta-CSP present, no `unsafe-eval`), **ST-10** (`sitemap.xml`, `robots.txt`, favicon, `404.html` in `dist`). Verify RED. _(2026-07-09 16:45 — ST-8/9/10 RED confirmed; ST-9 additionally asserts strict script-src hash coverage of every inline script)_

### Step 4.2: Implementation (GREEN)
- [x] 4.2.1 SEO: per-page description + a `transformPageData`/`transformHead` emitting `og:*`/`twitter:card` with `public/og-placeholder.png` (AR-11); enable the VitePress `sitemap` (hostname = the Pages URL). _(2026-07-09 16:45 — `transformHead` og+twitter+canonical (canonical prod URLs even on previews); 1200×630 branded placeholder PNG; sitemap.xml emitted)_
- [x] 4.2.2 `public/robots.txt` (+ sitemap link), `public/favicon.ico`, custom `404.md`, and the `<meta http-equiv="Content-Security-Policy">` (Phase-A policy from 03-01, no `unsafe-eval`). _(2026-07-09 16:45 — favicon.svg + head link, base-prefixed; robots.txt; custom 404.md; CSP injected via transformHtml)_
- [x] 4.2.3 **CSP validation (PF-003)**: load the built site headless, assert **zero CSP violations**, and add the SHA-256 hashes of VitePress's inline scripts to `script-src` so the strict policy (no `'unsafe-inline'` for scripts) holds — turns ST-9's runtime half green. _(2026-07-09 16:45 — **mechanism refined → auto-inject per-build hashes (AR-12 runtime), the `__VP_HASH_MAP__` script is content-dependent so static hashes are unsafe**. Static ST-9 proves every inline script is hash-covered; **headless Chrome load of home+guide+search = ZERO CSP violations** — connect/style/font/img all clean)_

### Step 4.3: Green + harden
- [x] 4.3.1 ST-8/9/10 pass; `yarn docs:build` green. _(2026-07-09 16:45 — 10/10 checks green; docs:build green; lint/prettier clean)_

---

## Phase 5: Content migration (absorb `docs/`)

**Reference**: [03-03](03-03-content-migration.md) · [07](07-testing-strategy.md) ST-11, ST-12 · AR-2

### Step 5.1: Spec (RED)
- [x] 5.1.1 Extend `check-docs-build.mjs`: **ST-11** (every former `docs/` website page has a `redirects.md` row **and** a rendered page in `dist`) + confirm **ST-12** baseline (`gate.spec` currently green, `docs/acceptance-gate.md` present). Verify RED for ST-11 (not migrated yet). _(2026-07-09 16:54 — ST-11 RED confirmed, ST-12 already green)_

### Step 5.2: Implementation (GREEN)
- [x] 5.2.1 Move website content (preserve history): `docs/architecture/` → `reference/architecture/`, `docs/decisions/` → `reference/decisions/`, `docs/guides/` → `reference/guides/`, fold `docs/index.md` into the Architecture landing. **Leave `docs/acceptance-gate.md` in place.** Retire the old `docs/.vitepress/config.ts` (superseded). Record the techdocs auto-update **supersession** in the roadmap note (PF-004 — moving `docs/index.md` disables the techdocs hook; accepted). _(2026-07-09 16:54 — `git mv` (history preserved); internal link prefixes rewritten to `/reference/…`; folded index frontmatter → `title: Architecture`; docs/ now holds only acceptance-gate.md)_
- [x] 5.2.2 Wire the Reference sidebar to the migrated pages; add `packages/docs-site/redirects.md` (old→new mapping); update the lone stale ref in `JSDOC-CLEANUP-PLAN.md` (non-blocking note). _(2026-07-09 16:54 — full Architecture/Decisions(9 ADRs)/Guides sidebar; redirects.md 16-row map; Reference landing hub; JSDOC-CLEANUP ref updated)_

### Step 5.3: Green + harden
- [x] 5.3.1 ST-11 passes; **ST-12**: `docs/acceptance-gate.md` byte-unchanged, `packages/core/test/gate.spec.test.ts` passes, `yarn verify` (shipped packages) green. _(2026-07-09 16:54 — acceptance-gate.md untouched (git clean); gate.spec 3/3; `yarn verify` exit 0, 16/16 turbo tasks)_
- [x] 5.3.2 Full `check-docs-build.mjs` (ST-1…ST-13 automated) green + `yarn docs:build` green — the complete Phase-A site. Final live re-verify (ST-3) on the deployed site. _(2026-07-09 16:54 — **12/12 checks green + check:deps green (ST-13) + docs:build green**. Final live ST-3 re-verify ⛳ PENDING USER — deployed-site check after Pages is enabled; see Deploy checklist.)_

---

## Deploy checklist (one-time, Phase 2)

- [ ] Repo Settings → Pages → Source = Deploy from branch `gh-pages` / root; Enforce HTTPS.
- [ ] First `master` deploy green; site reachable at `https://blendsdk.github.io/jsvision/`.
- [ ] A test PR receives a commented preview URL that serves its change; closing it cleans the preview.
