# Preflight Report — Site Foundation & Delivery Pipeline (RD-01 plan)

> **Artifact**: `codeops/features/docs-website/plans/site-foundation/`
> **Date**: 2026-07-09
> **Scan**: 13 dimensions, codebase-grounded
> **⚠️ SAME-SESSION REVIEW** — this plan was authored in the current session; findings were produced
> with deliberate adversarial counter-bias, and VitePress/GitHub-Actions behaviors (not in this repo)
> are flagged as spike-verify items rather than asserted as certainties. Consider a fresh-session
> re-scan for full independence.
> **Status**: ✅ PASSED — all 9 findings resolved (3 MAJOR fixed, 6 minor accepted); fixes applied to the plan on 2026-07-09

## Codebase Context Summary (verified)

| Claim in plan | Verified? | Evidence |
|---|---|---|
| Root `@jsvision/monorepo`, yarn 1.22.22, `workspaces:["packages/*"]`; `verify = yarn lint && turbo run typecheck build test check:docs` | ✅ | root `package.json` |
| `turbo.json` defines a `build` task; core/files/ui have `build` scripts | ✅ | `turbo.json:4`; `packages/{core,files,ui}/package.json` |
| `docs/acceptance-gate.md` is the oracle for `gate.spec.test.ts` | ✅ | `packages/core/test/gate.spec.test.ts:22,34` (`readFileSync(join(monorepoRoot,'docs','acceptance-gate.md'))`) |
| Moving architecture/decisions/guides/index is safe | ✅ (1 stale ref) | only `JSDOC-CLEANUP-PLAN.md:128` (ephemeral) references `docs/guides/development.md` |
| Vite 6 + `@xterm/*` are examples devDeps | ✅ | `packages/examples/package.json` (feasibility only, not RD-01 scope) |
| `docs/index.md` has `techdocs:true` frontmatter | ✅ | `docs/index.md:1-3` |

## Findings

### 🟠 PF-001 (MAJOR) — The docs-site `build` script defeats the AR-3 isolation decision
**Dimension 13 (Codebase Alignment) / 6 (Feasibility).** The plan (03-01) gives `packages/docs-site`
a `package.json` script named **`build`** (`vitepress build`) and adds a `docs-site#build` entry to
`turbo.json`. But `turbo run build` runs the `build` task in **every** workspace that defines it
(confirmed: core/files/ui all have `build` and are built by verify). A `pkg#task` entry in
`turbo.json` only *configures* that task (outputs/dependsOn) — it does **not** exclude the package
from `turbo run build`. So `yarn verify` (`… turbo run build …`) **would build the docs site**,
directly contradicting AR-3 ("isolated from `yarn verify`") and coupling every feature's verify to
(and potentially breaking it on) the docs build.
- **Options:** (a) name the docs-site build script something other than `build` (e.g. `vp:build`);
  root `docs:build = yarn workspace @jsvision/docs-site vp:build`; drop the `docs-site#build` turbo
  entry (or name it `docs-site#vp:build`) — truly isolated. (b) keep `build` but add
  `--filter=!@jsvision/docs-site` to the root `build` script (edits the shared verify path; affects
  all features). (c) accept coupling (reverse AR-3).
- **Recommendation:** (a). It honors AR-3 with zero blast radius on the shared verify script.
  *Confidence: high. Hardening: verified against `turbo.json` + the three existing `build` scripts.*

### 🟠 PF-002 (MAJOR) — Live PR previews will serve mismatched assets under a fixed `base`
**Dimension 6 (Feasibility) / 2 (Assumptions).** AR-1 wants live per-PR preview URLs at
`…/jsvision/pr-preview/pr-N/`, but the site is built once with `base:'/jsvision/'`. VitePress bakes
`base` into **absolute** asset/page-data URLs (`/jsvision/assets/…`). A preview served at a *deeper*
path still requests `/jsvision/assets/…` → it loads **production** assets, and the changed page's
hashed page-data (living under the preview dir) 404s — i.e. the very pages you open the preview to
review are broken. `rossjrw/pr-preview-action` does not rewrite paths. The plan's 03-02 claim
("VitePress's relative asset resolution handles the nested path") is inaccurate.
- **Options:** (a) the PR-preview build sets a **dynamic base** = `/jsvision/pr-preview/pr-<N>/` via
  an env var the VitePress config reads (`base: process.env.DOCS_BASE ?? '/jsvision/'`); prod uses
  `/jsvision/`. (b) fall back to the downloadable-artifact preview model (reverses AR-1's "live
  URL"). (c) different preview host (rejected — user chose GitHub Pages only).
- **Recommendation:** (a). Keeps live URLs (AR-1) and fixes assets; add a task + update 03-02.
  *Confidence: high (documented VitePress base behavior + pr-preview-action's own base-path caveat).
  Hardening: flagged as spike-verify since it's tool behavior, not repo code.*

### 🟠 PF-003 (MAJOR) — The meta-CSP will be violated by VitePress's own inline scripts
**Dimension 8 (Security) / 6 (Feasibility).** The Phase-A CSP sets `script-src 'self'` (no
`'unsafe-inline'`, no hashes). VitePress injects an **inline** `<script>` in `<head>` (the
appearance/color-scheme initializer, and other hydration inline snippets). Under `script-src 'self'`
these are blocked → CSP console violations + theme FOUC, on a site whose Security page advertises the
CSP as a feature. ST-9 ("no `unsafe-eval`") would pass while the site actually violates its own
policy.
- **Options:** (a) generate SHA-256 hashes of VitePress's inline scripts at build and inject them
  into `script-src` (a small post-build step) — strict CSP, honest. (b) add `'unsafe-inline'` to
  `script-src` (weaker; contradicts the "security is a selling point" framing). (c) add a Phase-4
  **validation task** that loads the built site and asserts zero CSP violations, and let it drive the
  exact directives (hashes vs relaxation) empirically.
- **Recommendation:** (c) as the mechanism (empirical), targeting (a) as the outcome. The plan
  currently budgets no work for reconciling the CSP with VitePress's real output — add it.
  *Confidence: medium-high (VitePress inline-appearance-script behavior; exact hashes must be
  measured on the built site). Hardening: spike-verify item.*

### 🟡 PF-004 (MINOR) — Moving `docs/index.md` disables the techdocs auto-update hook
**Dimension 13 (Migration & Compatibility).** The techdocs skill keys its auto-update on
`docs/index.md` having `techdocs:true` (confirmed present). Phase 5 moves `docs/index.md` into the
site → the hook silently stops firing.
- **Options:** (a) consciously accept it — the website supersedes the techdocs auto-update role
  (RD-08 owns architecture/ADR content now); record it in the plan + roadmap. (b) keep a stub
  `docs/index.md` (like `acceptance-gate.md`) so the hook still resolves. (c) leave all of
  `docs/` in place (reverses AR-2).
- **Recommendation:** (a) — the site is the techdocs now; just make the supersession explicit so it
  isn't a silent behavior change.

### 🟡 PF-005 (MINOR) — Prod and preview jobs can push `gh-pages` concurrently
**Dimension 11 (Ordering).** `concurrency: pages-${{ github.ref }}` differs for `master` vs a PR ref,
so a prod deploy and a preview deploy can run at once and both `git push` `gh-pages` → one fails.
Both actions retry, but it's avoidable.
- **Recommendation:** use a **shared** `concurrency.group` (e.g. `docs-gh-pages`) across both jobs so
  `gh-pages` writes serialize; keep the actions' push-retry as backup.

### 🟡 PF-006 (MINOR) — `keep_files:true` leaves deleted prod pages stale
**Dimension 9 (Edge Cases).** Required so prod deploy doesn't wipe `/pr-preview/*`, but it also means a
page removed from the site lingers on `gh-pages`.
- **Recommendation:** accept for Phase A; add a Should-Have to periodically prune (e.g. a scheduled
  clean deploy) — low priority.

### 🟡 PF-007 (MINOR) — ST-7's contrast-check mechanism is underspecified for RD-01
**Dimension 7 (Testability).** ST-7 asserts body contrast ≥ 4.5:1 but the automated a11y tooling (axe)
is RD-10, not RD-01.
- **Recommendation:** reword ST-7 to a tokens-level computed contrast check (or an explicit manual
  check) for RD-01, with full axe deferred to RD-10.

### 🟡 PF-008 (MINOR) — Reinforce isolation: docs-site defines no `check:deps`/`test`/`typecheck`
**Dimension 12 (Consistency).** For the isolation to hold, `packages/docs-site` must define only its
own scripts (dev / renamed-build / preview) and **no** `check:deps`/`test`/`typecheck` — turbo skips
tasks a package doesn't define. (VitePress devDeps could otherwise trip a `check:deps`.)
- **Recommendation:** state this explicitly in 03-01 (a one-liner) alongside PF-001's rename.

### 🟡 PF-009 (MINOR) — `docs.yml` trigger path `docs/**` is stale post-migration
**Dimension 12 (Consistency).** New site content lives in `packages/docs-site/**` from Phase 1; after
Phase 5, `docs/` holds only `acceptance-gate.md` (not website content). Triggering the docs deploy on
`docs/**` is noisy/incorrect.
- **Recommendation:** trigger on `packages/docs-site/**` + the workflow file (drop `docs/**`).

## Verdict

✅ **PASSED** — all findings resolved (user decisions 2026-07-09) and the fixes applied to the plan.
No CRITICALs. The plan's structure, spec-first ordering, register (11/11), and its core repo claims
were sound; the three MAJOR breaks were all in the *delivery mechanism* (turbo isolation, Pages
base-path, CSP) — exactly where fresh eyes earn their keep.

## Resolutions (applied)

| PF | Sev | Decision (user) | Applied in |
|----|-----|-----------------|------------|
| PF-001 | 🟠 | Rename the docs-site build script to `vp:build` (not `build`); no turbo `build` task → true AR-3 isolation | 03-01, 99 §1.2 |
| PF-002 | 🟠 | Dynamic per-PR base via `DOCS_BASE` (`base: process.env.DOCS_BASE ?? '/jsvision/'`); preview job sets the pr-subpath | 03-01, 03-02, 99 §1.2/§2.2 |
| PF-003 | 🟠 | Phase-4 CSP validation task → SHA-256 hashes of VitePress inline scripts in `script-src` (strict, no `unsafe-inline`) | 03-01, 07 (ST-9), 99 §4.2.3 (new task) |
| PF-004 | 🟡 | Accept techdocs-hook supersession; record it in the roadmap note | 03-03, 99 §5.2 |
| PF-005 | 🟡 | Shared `concurrency: docs-gh-pages` across both jobs | 03-02, 99 §2.2 |
| PF-006 | 🟡 | Accept `keep_files:true`; stale-page prune is a post-Phase-A Should-Have | 03-02 |
| PF-007 | 🟡 | ST-7 = tokens-level/manual contrast for RD-01; axe deferred to RD-10 | 07 (ST-7) |
| PF-008 | 🟡 | docs-site defines no `check:deps`/`test`/`typecheck` scripts | 03-01, 99 §1.2 |
| PF-009 | 🟡 | docs.yml triggers on `packages/docs-site/**` + workflow file (not `docs/**`) | 03-02, 99 §2.2 |

Task count: 24 → **25** (added §4.2.3 CSP validation).
