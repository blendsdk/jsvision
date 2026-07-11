# Roadmap: jsvision-plugin

> **Feature-Set**: jsvision-plugin
> **Status**: Executing
> **Created**: 2026-07-11
> **Last Updated**: 2026-07-11
> **Progress**: 1 / 2 plans (PL-01 done; PL-02 plugin-self-sync executing)
> **CodeOps Skills Version**: 3.3.2

A Claude Code plugin that makes Claude an expert jsvision TUI application developer — able to
scaffold, compose, run, verify, and extend jsvision apps. Ships a knowledge skill (`jsvision`) with
progressive-disclosure references (lifecycle · reactivity · layout · component catalog · the ~12
gotchas · run/verify loop · theming · widget authoring), a deterministic scaffolder skill
(`jsvision-new-app`), four verified recipe apps spanning the app spectrum (data-driven · forms ·
file tools · live/dashboard), and a widget-authoring path — all guarded by a `check-plugin.mjs`
integrity gate in `yarn verify`. Used inside this monorepo (apps built as `packages/<app>/`), with
publish-agnostic knowledge so a future standalone/published path is a one-spot change. Standalone
plan (no upstream RD); the plan's `01-requirements.md` owns the requirements.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| PL-01 | jsvision Claude Code plugin (skill + scaffolder + recipes + widget authoring) | — (standalone plan) | [plugin-v1](plans/plugin-v1/00-index.md) | Done | ✅ | 2026-07-11 | **✅ DONE (2026-07-11)** — `exec_plan` complete, 37/37 tasks / 5 phases, spec-first. Ships `tools/claude-plugin/` (`plugin.json` + `marketplace.json` + the `jsvision` knowledge skill with 8 references incl. the 12 gotchas + the `jsvision-new-app` scaffolder skill + templates), 4 verified recipe modules + an example custom widget in `packages/examples/recipes/`, and `scripts/check-plugin.mjs` (manifest schema · link-graph · snippet-drift · gotchas completeness · `@jsvision/ui` barrel-coverage) wired into `yarn verify`. Full `yarn verify` green (22/22, `check-plugin: PASS`); ST-17 acceptance proven (scaffold `packages/sample/` → `tsc --noEmit` 0 + smoke 1/1 → `claude plugin validate`). Commits 8fea5e4 · 4bf7f5f · 28286df · c93437d · ce9acd6. — — — **Plan created — 37 tasks / 5 phases, spec-first.** Zero-Ambiguity Gate PASSED (19/19); includes a Tier-0 **barrel-coverage** drift gate so a new/changed SDK widget turns `yarn verify` red until documented (AR-18). Decisions: apps + widget authoring (AR-3); in-repo, publish-agnostic (AR-2); all four recipe archetypes (AR-4); recipe code = real smoke-tested modules in `packages/examples/`, quoted by the plugin docs (AR-5); scaffolder = deterministic Node script wrapped by a manual skill (AR-8); `check-plugin.mjs` invoked directly by `yarn verify` (AR-10); plugin at `tools/claude-plugin/` (AR-13); `jsvision-builder` subagent + hooks deferred (AR-6/AR-7). **Preflight ✅ PASSED (2026-07-11)** — 7 findings (3🟠/3🟡/1🔵), all applied: `marketplace.json` schema corrected per live docs (PF-001), recipe embedding = a literal drift-checked copy not a VitePress `<<<` transclusion (PF-002), barrel-coverage scoped to class exports (PF-003), + minors; the plugin/skill format was validated against the live docs. See `plans/plugin-v1/00-preflight-report.md`. Next: `exec_plan plugin-v1`. |
| PL-02 | Plugin self-sync — AI-assisted auto-update of stale plugin content on SDK change | — (standalone plan) | [plugin-self-sync](plans/plugin-self-sync/00-index.md) | Executing | 🔄 | 2026-07-11 | **🔄 EXECUTING (2026-07-11)** — `exec_plan`, spec-first per phase. **Plan created — 30 tasks / 4 phases, spec-first** (`make_plan`). Zero-Ambiguity Gate PASSED (16/16). Deterministic `detectDrift()` (extends `check-plugin.mjs`) → a **deterministic** snippet `--fix` (copy source region; no AI) + an **AI** catalog-entry draft for an undocumented widget (grounded in its JSDoc+`@example`) via **both** a manual `jsvision-plugin-sync` Claude skill (local, no key) and a `yarn plugin:sync` Anthropic-API script (injected client seam, tests never hit the network). `yarn verify` gates every output; nothing auto-commits; a `plugin-self-sync.yml` workflow is scaffolded **disabled** (`workflow_dispatch`-only, no secret). Hybrid "local now, CI-ready" (AR-1); agentic recipe repair + prose refresh deferred (AR-15). **Preflight ✅ PASSED (2026-07-11)** — 7 findings (3🟠/3🟡/1🔵), all accepted + applied: injectable `roots` filesystem seam (`DEFAULT_ROOTS`) on `detectDrift`/`fixSnippetDrift`/`fixUndocumentedWidgets` so seeded-drift specs never mutate the repo (PF-001); `detectDrift` reuses `checkBarrelCoverage` — findings ≡ the gate's, one predicate (PF-002); deterministic `New — needs categorization` holding heading replaces the underivable `sectionFor` (PF-003); + minors (readWidgetDoc scope, `yarn.lock`, adapter model/`max_tokens`). See `plans/plugin-self-sync/00-preflight-report.md`. Next: `exec_plan plugin-self-sync`. |

## Notes

- 2026-07-11: **PL-02 `plugin-self-sync` → 🔬 PLAN PREFLIGHTED** (`preflight`, fresh session — recon
  independently re-verified every claim against real code; empirically confirmed the detector predicate
  matches the gate on all 39 `@jsvision/ui` class exports, so ST-1 holds today). **✅ PASSED — 7
  findings (3🟠/3🟡/1🔵), all accepted + applied.** MAJORs: an injectable `roots` filesystem seam
  (`DEFAULT_ROOTS`) — the analogue of AR-10's injected client — so seeded-drift specs never touch the
  repo (PF-001); `detectDrift` reuses `checkBarrelCoverage` so its findings are, by construction,
  exactly the gate's, honoring AR-6's one-source-of-truth (PF-002); a deterministic `New — needs
  categorization` holding heading replaces the underivable `sectionFor`, with ST-5/ST-7 oracles softened
  to the gate-checkable fact (PF-003). Minors: `readWidgetDoc` scope corrected to real doc-extraction,
  `yarn.lock` update called out (frozen-lockfile), real-adapter model + `max_tokens` named. Report:
  `plans/plugin-self-sync/00-preflight-report.md`. Next: `exec_plan plugin-self-sync`.
- 2026-07-11: **PL-02 `plugin-self-sync` → 📋 PLAN CREATED** (`make_plan`, on `feat/plugin-self-sync`
  after PL-01 merged to master). An AI-assisted self-updater that removes manual authoring from the
  drift loop PL-01 made loud. Design (Zero-Ambiguity Gate 16/16): a structured `detectDrift()`
  extending `check-plugin.mjs` → a **deterministic** snippet `--fix` (copy the source `#region`; no
  AI, AR-3) + an **AI** catalog-entry draft for an undocumented widget grounded in its JSDoc+`@example`
  (AR-14), reachable via **both** a manual `jsvision-plugin-sync` skill (local, no API key) and a
  `yarn plugin:sync` Anthropic-API script behind an injected client seam so tests never hit the network
  (AR-4/AR-7/AR-10). Every output is `yarn verify`-gated and human-reviewed; nothing auto-commits
  (AR-13). CI is scaffolded **disabled** — `plugin-self-sync.yml` is `workflow_dispatch`-only and
  references no secret (AR-8), keeping `ci.yml` secret-free; `@anthropic-ai/sdk` is a tooling devDep
  only (AR-9). Deferred: agentic recipe repair + prose refresh (AR-15). 30 tasks / 4 phases, spec-first.
  Next: `preflight plugin-self-sync` (optional) or `exec_plan plugin-self-sync`.
- 2026-07-11: **PL-01 → ✅ DONE** (`exec_plan plugin-v1 --ask-commit`). All 37 tasks / 5 phases
  complete, spec-first. Delivered: the `jsvision` knowledge skill (router + 8 references: lifecycle ·
  reactivity · layout · component catalog (all 38 widget classes) · the 12 gotchas · run/verify loop ·
  theming · widget authoring) with 5 recipe pages; the `jsvision-new-app` deterministic scaffolder
  (zero-dep Node generator → runnable `packages/<slug>/` + smoke test, path-safe + no-overwrite); 4
  verified recipe apps + an example custom widget as real smoke-tested modules in
  `packages/examples/recipes/` (ST-7…11); and the `check-plugin.mjs` Tier-0 integrity gate (manifest
  schema · reference link-graph · recipe snippet-drift · gotchas completeness · barrel-coverage
  forward+reverse) wired into `yarn verify` (ST-12…18). Full `yarn verify` green (22/22 turbo tasks,
  `check-plugin: PASS`); **ST-17 acceptance** proven end-to-end (scaffolded app `tsc --noEmit` exit 0 +
  smoke 1/1, `claude plugin validate` passed). Phase commits: 8fea5e4 (P1 skeleton) · 4bf7f5f (P2
  scaffolder) · 28286df (P3 recipes+widget) · c93437d (P4 knowledge base) · ce9acd6 (P5 gate+verify).
  Feature v1 complete; **PL-02 `plugin-self-sync`** (AI auto-updates the plugin on SDK change) stays
  backlog. Next for PL-02: `make_plan plugin-self-sync`.
- 2026-07-11: **PL-01 → PLAN PREFLIGHTED** 🔬 (`preflight`, same-session — every format claim
  re-verified against the **live Claude Code docs**, every codebase claim against real code via an
  independent recon). **✅ PASSED — 7 findings (3🟠/3🟡/1🔵), all applied.** MAJORs: `marketplace.json`
  schema corrected per live docs (PF-001); recipe embedding = a literal drift-checked copy, not a
  build-time `<<<` transclusion a skill can't expand (PF-002); barrel-coverage scoped to class exports
  so it stays deterministic + low-noise (PF-003). The plugin/skill format (SKILL.md frontmatter,
  `disable-model-invocation`, `${CLAUDE_PLUGIN_ROOT}`, `claude plugin validate`/`--plugin-dir`) was
  verified correct. Report: `plans/plugin-v1/00-preflight-report.md`. Next: `exec_plan plugin-v1`.
- 2026-07-11: **New feature `jsvision-plugin` + PL-01 → PLAN CREATED** 📋 (`make_plan`). A Claude
  Code plugin (`tools/claude-plugin/`, id `jsvision-plugin`) that turns Claude into an expert
  jsvision app developer: the `jsvision` knowledge skill (mental model + non-negotiables + a router
  into 8 reference files incl. the ~12 real-code gotchas + the headless-verify loop), the
  `jsvision-new-app` scaffolder (a deterministic zero-dep Node generator emitting a complete
  runnable `packages/<slug>/` + smoke test), four verified recipe apps (data-driven/master-detail ·
  forms/dialogs/wizards · file & text tools · live/dashboard + a browser-hosted variant) as real
  modules in `packages/examples/` quoted by the recipe docs, an example custom widget + a
  widget-authoring reference, and a `scripts/check-plugin.mjs` integrity gate (manifest schema ·
  link-graph · snippet-drift · gotchas completeness) wired directly into `yarn verify`. Grounded in
  a deep review of the `@jsvision/ui` surface, real example apps, and the current Claude Code
  plugin/skill format. Zero-Ambiguity Gate PASSED (17/17). Portfolio now 6 features. Next:
  `exec_plan plugin-v1` (optionally `preflight plugin-v1` first).
