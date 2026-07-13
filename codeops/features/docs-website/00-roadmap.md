# Roadmap: Docs Website

> **Feature-Set**: Docs Website
> **Status**: In Progress
> **Created**: 2026-07-09
> **Last Updated**: 2026-07-11
> **Progress**: 4 / 10 (40%) — RD-06 ✅ Done (api-reference — generated TypeDoc reference, bidirectional cross-links, 20/20 gate) · RD-01 implementation ✅ (all 25 tasks; live deploy acceptance pending user) · RD-02 ✅ Done (all 17 tasks; `@jsvision/web` shipped — 41 tests ST-1…ST-12, dogfooded into web-xterm) · RD-03 ✅ Done (7 phases / 40 tasks; live-example system shipped — 8 seed examples, ST-1…ST-14 green, `yarn verify` 22/22, docs gate 14/14)
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
| RD-01 | Site foundation & delivery pipeline | [RD-01](requirements/RD-01-site-foundation.md) | [site-foundation](plans/site-foundation/00-index.md) · [preflight](plans/site-foundation/00-preflight-report.md) | Done (impl) | ✅ | 2026-07-09 | Done (impl) — VitePress site · GitHub Pages (prod + PR previews) · IA/nav/search/SEO/CSP/404 · absorbs root docs/ · outstanding (user): enable Pages, then verify live prod + PR preview. |
| RD-02 | `@jsvision/web` browser runtime | [RD-02](requirements/RD-02-web-runtime.md) | [web-runtime](plans/web-runtime/00-index.md) · [preflight](plans/web-runtime/00-preflight-report.md) | Done | ✅ | 2026-07-09 | Shipped — @jsvision/web browser runtime: createBrowserHost/mountApp · buildBrowserCaps · virtual FileSystem · key-reclaim · outbound clipboard · browser-stubs · dogfooded into web-xterm. |
| RD-03 | Live-example system | [RD-03](requirements/RD-03-live-example-system.md) | [live-example-system](plans/live-example-system/00-index.md) · [register](plans/live-example-system/00-ambiguity-register.md) · [preflight](plans/live-example-system/00-preflight-report.md) | Done | ✅ | 2026-07-10 | Shipped — docs samples run live in xterm.js via mountApp (shown == running) · 8 seed examples · DemoShell · Play · ↳ remediation ✅ (resize · draggable shell · reopen dialogs · Source fix). |
| RD-04 | Landing / pitch surface | [RD-04](requirements/RD-04-landing-pitch.md) | — | RD Drafted | ✏️ | 2026-07-09 | Drafted — landing/pitch: hero + live proof · Getting Started · Core Concepts · Why/comparison · degit starter · depends RD-01, RD-03. |
| RD-05 | Component documentation system | [RD-05](requirements/RD-05-component-docs.md) | — | RD Drafted | ✏️ | 2026-07-09 | Drafted — per-component page template + full ~40 coverage · hierarchy · status badges · components.json · depends RD-03. |
| RD-06 | API reference (TypeDoc) | [RD-06](requirements/RD-06-api-reference.md) | [api-reference](plans/api-reference/00-index.md) | Done | ✅ | 2026-07-11 | Done — generated TypeDoc→md→VitePress reference for 4 public barrels · gitignored/regen per-package · bidirectional symbol↔page cross-links · drift-gated 20/20 · TypeDoc devDeps only. |
| RD-07 | Sample applications | [RD-07](requirements/RD-07-sample-apps.md) | — | RD Drafted | ✏️ | 2026-07-09 | Drafted — sample apps: Todo · tvedit (virtual FS + local files) · polished kitchen-sink · file/data browser, each in DemoShell · depends RD-02, RD-03. |
| RD-08 | Reference & trust content | [RD-08](requirements/RD-08-reference-trust.md) | — | RD Drafted | ✏️ | 2026-07-09 | Drafted — reference/trust: architecture · guides/cookbook · FAQ · a11y · security · perf · compat · theming gallery · versioning · contributing · absorbs docs/ techdocs · depends RD-03, RD-05. |
| RD-09 | Anti-drift governance & automation | [RD-09](requirements/RD-09-anti-drift-governance.md) | — | RD Drafted | ✏️ | 2026-07-09 | Drafted — anti-drift: CLAUDE.md prime directive · hard-fail check:docs-site gate · example compile/smoke in CI · Playwright screenshots/OG · README · llms.txt · depends RD-03, RD-05. |
| RD-10 | Non-functional requirements | [RD-10](requirements/RD-10-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-09 | Spans all. Perf budgets (lazy terminals) · a11y (WCAG) · security/CSP · SEO · browser support · content-ops. |

## Implementation Phases

| Phase | RDs | Deliverable (testable slice) |
|-------|-----|------------------------------|
| A: MVP | RD-01, RD-02, RD-03, RD-04 (partial), 1 component via RD-05 | Deployed site with a working live example + a file-dialog demo |
| B: Coverage | RD-05 (full) | Every component page + live example + hierarchy |
| C: Reference & trust | RD-06, RD-08 (reference), RD-10 | API ref, search, perf/security/a11y, compat, versioning |
| D: Sample apps | RD-07 | Todo, tvedit, polished kitchen-sink, file/data browser |
| E: Pitch-finish | RD-08 (theming/gallery), RD-09, Want-items | Why/comparison, theming gallery, screenshots/OG, README, anti-drift gate |
