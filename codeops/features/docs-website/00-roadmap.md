# Roadmap: Docs Website

> **Feature-Set**: Docs Website
> **Status**: In Progress
> **Created**: 2026-07-09
> **Last Updated**: 2026-07-09
> **Progress**: 0 / 10 (0%)
> **CodeOps Skills Version**: 3.3.2

A professional, DX/UX-first **VitePress** documentation & showcase website for JSVision — the
project's sales pitch — deployed to **GitHub Pages** via CI/CD. Its defining feature: **every
example runs live, client-side, in xterm.js** (no backend), because the engine is pure
byte-in/byte-out. Proven by the `web-xterm` spike, extracted here into a first-class `@jsvision/web`
runtime. File/dir dialogs run against a browser virtual FileSystem. Docs cannot drift from the code:
every example is a real, compiled, smoke-tested module embedded by snippet, guarded by a hard-fail
`check:docs-site` CI gate. Requirements: 10 RDs behind a passed Zero-Ambiguity Gate (33/33).

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Site foundation & delivery pipeline | [RD-01](requirements/RD-01-site-foundation.md) | [site-foundation](plans/site-foundation/00-index.md) · [preflight](plans/site-foundation/00-preflight-report.md) | Plan Preflighted | 🔬 | 2026-07-09 | Phase A. `packages/docs-site` VitePress app · GitHub Pages (gh-pages model: peaceiris prod + live PR previews) · `base:'/jsvision/'` · IA/nav · local search · SEO/OG/CSP/404 · absorbs root `docs/` (keeps `acceptance-gate.md`) · isolated from `yarn verify`. **5 phases / 25 tasks, spec-first.** Preflight ✅ PASSED (9 findings; 3 MAJOR delivery-mechanism fixes applied: `vp:build` isolation, dynamic PR-preview base, CSP hashes). Next: `exec_plan site-foundation`. |
| RD-02 | `@jsvision/web` browser runtime | [RD-02](requirements/RD-02-web-runtime.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase A. Extract the web-xterm host → tested package · virtual FileSystem · key-chord reclaim · clipboard bridge · node-builtin stubs. |
| RD-03 | Live-example system | [RD-03](requirements/RD-03-live-example-system.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase A. Example-module contract · Play-button live dialog · snippet embed · DemoShell (About + theme switch) · headless smoke · a11y source-beside · no-keyboard fallback. Depends RD-01, RD-02. |
| RD-04 | Landing / pitch surface | [RD-04](requirements/RD-04-landing-pitch.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase A(partial). Hero + live proof · Getting Started · Core Concepts · Why/comparison · degit starter. Depends RD-01, RD-03. |
| RD-05 | Component documentation system | [RD-05](requirements/RD-05-component-docs.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase B. Per-component page template + full ~40 coverage · hierarchy · status badges · `components.json`. Depends RD-03. |
| RD-06 | API reference (TypeDoc) | [RD-06](requirements/RD-06-api-reference.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase C. TypeDoc → markdown → VitePress · CI regen · public-surface scoping · cross-links. Depends RD-01. |
| RD-07 | Sample applications | [RD-07](requirements/RD-07-sample-apps.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase D. Todo · tvedit (virtual FS + local files) · polished kitchen-sink (live navigator) · file/data browser — each in DemoShell. Depends RD-02, RD-03. |
| RD-08 | Reference & trust content | [RD-08](requirements/RD-08-reference-trust.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase C/E. Architecture · guides/cookbook · best-practices · FAQ · a11y · security · perf · compat matrix · theming gallery + token ref + embedded designer · versioning/changelog/roadmap · contributing. Absorbs `docs/` techdocs; ADRs authored here. Depends RD-03, RD-05. |
| RD-09 | Anti-drift governance & automation | [RD-09](requirements/RD-09-anti-drift-governance.md) | — | RD Drafted | ✏️ | 2026-07-09 | Phase E. CLAUDE.md prime directive · hard-fail `check:docs-site` gate · example compile/smoke in CI · Playwright screenshots/OG · README rewrite · `llms.txt`. Depends RD-03, RD-05. |
| RD-10 | Non-functional requirements | [RD-10](requirements/RD-10-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-09 | Spans all. Perf budgets (lazy terminals) · a11y (WCAG) · security/CSP · SEO · browser support · content-ops. |

## Implementation Phases

| Phase | RDs | Deliverable (testable slice) |
|-------|-----|------------------------------|
| A: MVP | RD-01, RD-02, RD-03, RD-04 (partial), 1 component via RD-05 | Deployed site with a working live example + a file-dialog demo |
| B: Coverage | RD-05 (full) | Every component page + live example + hierarchy |
| C: Reference & trust | RD-06, RD-08 (reference), RD-10 | API ref, search, perf/security/a11y, compat, versioning |
| D: Sample apps | RD-07 | Todo, tvedit, polished kitchen-sink, file/data browser |
| E: Pitch-finish | RD-08 (theming/gallery), RD-09, Want-items | Why/comparison, theming gallery, screenshots/OG, README, anti-drift gate |

## Notes

- 2026-07-09: **RD-01 → PLAN PREFLIGHTED** 🔬 ([report](plans/site-foundation/00-preflight-report.md))
  via `preflight` (same-session, codebase-grounded, 13 dimensions). **✅ PASSED — 9 findings, all
  resolved + applied.** Verified core repo claims (gate.spec reads `docs/acceptance-gate.md`; moving
  the other `docs/` content is safe; turbo `build` semantics). 3 MAJOR delivery-mechanism fixes:
  **PF-001** the docs-site build script must be named `vp:build` (not `build`) or `turbo run build`/
  `yarn verify` would build it (defeating AR-3); **PF-002** live PR previews need a dynamic per-PR
  `DOCS_BASE` or they load production assets and 404 the changed pages; **PF-003** the strict meta-CSP
  is violated by VitePress's inline scripts → add SHA-256 hashes (Phase-4 validation task). 6 minors
  accepted (techdocs supersession, shared gh-pages concurrency, keep_files note, ST-7 wording,
  no-check:deps, trigger paths). Task count 24→25. Next: `exec_plan site-foundation`.
- 2026-07-09: **RD-01 → PLAN CREATED** 📋 ([plan](plans/site-foundation/00-index.md)) via `make_plan`.
  9 docs (00-index · 01-requirements · 02-current-state · 03-01 workspace+VitePress · 03-02 deploy
  pipeline · 03-03 content migration · 07-testing-strategy ST-1…ST-14 · 99-execution-plan · register).
  **5 phases / 24 tasks**, spec-first, each phase a deployable/testable slice (live skeleton at Phase 2).
  Zero-Ambiguity Gate PASSED (11/11: 3 new plan decisions — live PR-preview URLs via the gh-pages model,
  move `docs/` website content but keep `acceptance-gate.md`, docs-site isolated from `yarn verify` — + 8
  imported). Grounded in current state: `@jsvision/monorepo` yarn 1.22 `packages/*`, `docs/acceptance-gate.md`
  is a `gate.spec` oracle (must not move). Next: `exec_plan site-foundation` (optionally `preflight` first).
- 2026-07-09: **Feature-set created + all 10 RDs drafted** ✏️ via `make_requirements`. Zero-Ambiguity
  Gate PASSED (33/33). Grounded in the in-repo `packages/examples/web-xterm/` spike (client-side
  live demos proven) and `@jsvision/files`' injectable `FileSystem` (browser file dialogs). Confirmed
  decisions: client-side only / GitHub Pages, extract `@jsvision/web`, TypeDoc→md→VitePress, docs
  examples separate but smoke-tested + snippet-embedded, DemoShell (About + theme, all 13 presets),
  Playwright-on-live-page screenshots, 4th sample app (file/data browser), VitePress local search,
  hard-fail anti-drift gate. Next: `make_plan` for RD-01 (Phase A).
