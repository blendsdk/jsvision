# Roadmap: jsvision-plugin

> **Feature-Set**: jsvision-plugin
> **Status**: Executing
> **Created**: 2026-07-11
> **Last Updated**: 2026-07-11
> **Progress**: 0 / 1 plans (PL-02 self-sync in backlog — not yet planned)
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
| PL-01 | jsvision Claude Code plugin (skill + scaffolder + recipes + widget authoring) | — (standalone plan) | [plugin-v1](plans/plugin-v1/00-index.md) | Executing | 🔄 | 2026-07-11 | **Plan created — 37 tasks / 5 phases, spec-first.** Zero-Ambiguity Gate PASSED (19/19); includes a Tier-0 **barrel-coverage** drift gate so a new/changed SDK widget turns `yarn verify` red until documented (AR-18). Decisions: apps + widget authoring (AR-3); in-repo, publish-agnostic (AR-2); all four recipe archetypes (AR-4); recipe code = real smoke-tested modules in `packages/examples/`, quoted by the plugin docs (AR-5); scaffolder = deterministic Node script wrapped by a manual skill (AR-8); `check-plugin.mjs` invoked directly by `yarn verify` (AR-10); plugin at `tools/claude-plugin/` (AR-13); `jsvision-builder` subagent + hooks deferred (AR-6/AR-7). **Preflight ✅ PASSED (2026-07-11)** — 7 findings (3🟠/3🟡/1🔵), all applied: `marketplace.json` schema corrected per live docs (PF-001), recipe embedding = a literal drift-checked copy not a VitePress `<<<` transclusion (PF-002), barrel-coverage scoped to class exports (PF-003), + minors; the plugin/skill format was validated against the live docs. See `plans/plugin-v1/00-preflight-report.md`. Next: `exec_plan plugin-v1`. |
| PL-02 | Plugin self-sync — AI auto-updates stale plugin content on SDK change | — (to be planned) | — | Backlog | ⬜ | 2026-07-11 | Deterministic detect (barrel diff / snippet hash / compiler — exact + free) → AI-generate only the delta (a catalog entry from the widget's JSDoc+`@example`; a snippet re-sync; a capped agentic recipe repair) → `yarn verify` gate → **open a PR a human approves** (AR-19). AI never on the blocking verify path; runs in CI on SDK change; low token cost (delta-scoped, deterministic pre-filter). Prereq: PL-01's Tier-0 gate (AR-18). Next: `make_plan` this as `plugin-self-sync`. |

## Notes

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
