# Execution Plan: Site Foundation & Delivery Pipeline

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-09
> **Progress**: 0/24 tasks (0%)
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
| 4 | SEO + CSP + static assets | 5 |
| 5 | Content migration (absorb `docs/`) | 5 |

**Total: 24 tasks across 5 phases.**

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
- [ ] 1.1.1 Write `packages/docs-site/scripts/check-docs-build.mjs` asserting **ST-1** (build exits 0, `dist/index.html` exists, all asset URLs `/jsvision/`-prefixed) and **ST-2** (each nav-section page built). Assertions read the built `dist`.
- [ ] 1.1.2 Verify RED: the script fails (no `packages/docs-site` / no `dist` yet).

### Step 1.2: Implementation (GREEN)
- [ ] 1.2.1 Scaffold `packages/docs-site`: `package.json` (`@jsvision/docs-site`, private, `type:module`, scripts dev/build/preview, VitePress 1.x **devDependency only**) + placeholder `index.md` and one placeholder page per section (guide/components/apps/api/reference).
- [ ] 1.2.2 Minimal `.vitepress/config.ts` (`base:'/jsvision/'`, title, nav skeleton) + root `docs:dev`/`docs:build` scripts + `turbo.json` `docs-site#build` (`outputs:['.vitepress/dist/**']`, no `dependsOn`, **isolated** from the default build/verify per AR-3).

### Step 1.3: Green + harden
- [ ] 1.3.1 `yarn docs:build` green; `check-docs-build.mjs` passes ST-1/ST-2; **ST-13** `yarn check:deps` green for all shipped packages (no toolchain leak).

---

## Phase 2: GitHub Pages delivery (prod + live PR previews)

**Reference**: [03-02](03-02-deploy-pipeline.md) · [07](07-testing-strategy.md) ST-3, ST-14 · AR-1

### Step 2.1: Spec (RED)
- [ ] 2.1.1 Extend `check-docs-build.mjs` (or a small companion) to assert **ST-14**: `.github/workflows/docs.yml` parses, triggers on the site paths, declares `permissions: contents:write` + `pull-requests:write`, and uses only `GITHUB_TOKEN` (no stored secret). Verify RED (no workflow yet).

### Step 2.2: Implementation (GREEN)
- [ ] 2.2.1 Add `.github/workflows/docs.yml`: **production** job on `master` (checkout → setup-node 22 → `yarn install --frozen-lockfile` → `yarn docs:build` → `peaceiris/actions-gh-pages@v4` publish `dist` to `gh-pages` root, `keep_files:true`); **preview** job on `pull_request` (build → `rossjrw/pr-preview-action@v1` to `/pr-preview/pr-N/`, comment URL, cleanup on close); concurrency + path filters. Do **not** modify `ci.yml`.
- [ ] 2.2.2 Document the one-time Pages prerequisite (Settings → Pages → Deploy from branch `gh-pages`/root, enforce HTTPS) in the workspace README + the deploy checklist below.

### Step 2.3: Green + manual acceptance
- [ ] 2.3.1 ST-14 passes. **Manual acceptance (ST-3)** after Pages is enabled: merge to `master` → site 200 at `https://blendsdk.github.io/jsvision/`; open a PR → preview URL commented + serves the changed page. Record the result here. _(This is the deployable-slice checkpoint — the user can test live.)_

---

## Phase 3: IA / nav / theme / search / code-UX

**Reference**: [03-01](03-01-workspace-and-vitepress.md) · [07](07-testing-strategy.md) ST-4, ST-5, ST-6, ST-7 · AR-8

### Step 3.1: Spec (RED)
- [ ] 3.1.1 Extend `check-docs-build.mjs`: **ST-4** (link-check over `dist`, nav/sidebar skeleton present), **ST-5** (local search index emitted), **ST-6** (a TS block has Shiki markup + copy button), **ST-7** (both color schemes defined, body contrast ≥ 4.5:1). Verify RED.

### Step 3.2: Implementation (GREEN)
- [ ] 3.2.1 Full `themeConfig.nav` + `sidebar` (Home · Guide · Components · Apps · API · Reference) with placeholder routes (no dead links), GitHub/npm social links, and `search:{provider:'local'}`.
- [ ] 3.2.2 Brand theme: `theme/index.ts` extends DefaultTheme + `custom.css` brand tokens for light **and** dark (contrast-checked); confirm Shiki TS highlight + copy button; a sample TS snippet page.

### Step 3.3: Green + harden
- [ ] 3.3.1 ST-4/5/6/7 pass; `yarn docs:build` green; dark/light toggle verified.

---

## Phase 4: SEO + CSP + static assets

**Reference**: [03-01](03-01-workspace-and-vitepress.md) · [07](07-testing-strategy.md) ST-8, ST-9, ST-10 · AR-9, AR-11

### Step 4.1: Spec (RED)
- [ ] 4.1.1 Extend `check-docs-build.mjs`: **ST-8** (unique title + OG/Twitter meta per page), **ST-9** (meta-CSP present, no `unsafe-eval`), **ST-10** (`sitemap.xml`, `robots.txt`, favicon, `404.html` in `dist`). Verify RED.

### Step 4.2: Implementation (GREEN)
- [ ] 4.2.1 SEO: per-page description + a `transformPageData`/`transformHead` emitting `og:*`/`twitter:card` with `public/og-placeholder.png` (AR-11); enable the VitePress `sitemap` (hostname = the Pages URL).
- [ ] 4.2.2 `public/robots.txt` (+ sitemap link), `public/favicon.ico`, custom `404.md`, and the `<meta http-equiv="Content-Security-Policy">` (Phase-A policy from 03-01, no `unsafe-eval`).

### Step 4.3: Green + harden
- [ ] 4.3.1 ST-8/9/10 pass; `yarn docs:build` green.

---

## Phase 5: Content migration (absorb `docs/`)

**Reference**: [03-03](03-03-content-migration.md) · [07](07-testing-strategy.md) ST-11, ST-12 · AR-2

### Step 5.1: Spec (RED)
- [ ] 5.1.1 Extend `check-docs-build.mjs`: **ST-11** (every former `docs/` website page has a `redirects.md` row **and** a rendered page in `dist`) + confirm **ST-12** baseline (`gate.spec` currently green, `docs/acceptance-gate.md` present). Verify RED for ST-11 (not migrated yet).

### Step 5.2: Implementation (GREEN)
- [ ] 5.2.1 Move website content (preserve history): `docs/architecture/` → `reference/architecture/`, `docs/decisions/` → `reference/decisions/`, `docs/guides/` → `reference/guides/`, fold `docs/index.md` into the Architecture landing. **Leave `docs/acceptance-gate.md` in place.** Retire the old `docs/.vitepress/config.ts` (superseded).
- [ ] 5.2.2 Wire the Reference sidebar to the migrated pages; add `packages/docs-site/redirects.md` (old→new mapping); update the lone stale ref in `JSDOC-CLEANUP-PLAN.md` (non-blocking note).

### Step 5.3: Green + harden
- [ ] 5.3.1 ST-11 passes; **ST-12**: `docs/acceptance-gate.md` byte-unchanged, `packages/core/test/gate.spec.test.ts` passes, `yarn verify` (shipped packages) green.
- [ ] 5.3.2 Full `check-docs-build.mjs` (ST-1…ST-13 automated) green + `yarn docs:build` green — the complete Phase-A site. Final live re-verify (ST-3) on the deployed site.

---

## Deploy checklist (one-time, Phase 2)

- [ ] Repo Settings → Pages → Source = Deploy from branch `gh-pages` / root; Enforce HTTPS.
- [ ] First `master` deploy green; site reachable at `https://blendsdk.github.io/jsvision/`.
- [ ] A test PR receives a commented preview URL that serves its change; closing it cleans the preview.
