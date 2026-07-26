# Roadmap: Code-grade Editor (Lezer)

> **Feature-Set**: code-editor
> **Status**: Active (requirements drafted)
> **Created**: 2026-07-18
> **Last Updated**: 2026-07-18
> **Progress**: 0 / 4 RDs done · RD-01…04 ✏️ drafted (core seam + roles · `@jsvision/lang` Lezer engine · editor view features · non-functional)
> **CodeOps Skills Version**: 3.9.0

The **code-development-grade editor** (syntax highlighting + tree-based folding + line numbers) on
the existing `@jsvision/ui` editor, powered by **Lezer** (`@lezer/*`) behind a `Tokenizer`/`FoldProvider`
seam. Engine + packaging settled in a feasibility spike (`plans/feasibility-spike/decision-memo.md`);
product design disambiguated in a `grill_me` session (`shared-understanding.md`); all decisions in
`requirements/00-ambiguity-register.md`. Historical name "RD-08 Editor family" / GH #18 (closed);
build tracked by **GH #102**.

**Prerequisite (not an RD here):** extract the editor into `@jsvision/editor` — **GH #101**, lands
before RD-03.

**Deferred (own issues):** multiple cursors #104 · word-wrap #105 · autocomplete #106 ·
diagnostics/LSP #107.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| RD-01 | Core seam types & syntax theme roles | [RD-01](requirements/RD-01-core-seam-and-roles.md) | — | RD Drafted | ✏️ | 2026-07-18 | `Tokenizer`/`FoldProvider`/`DocReader`/`LanguageProvider` seam types + `SyntaxBucket` + ~11 theme roles in `@jsvision/core` (zero-dep). Foundation. |
| RD-02 | `@jsvision/lang` — Lezer engine (JSON + TS/JS) | [RD-02](requirements/RD-02-lang-engine.md) | — | RD Drafted | ✏️ | 2026-07-18 | New opt-in package: Lezer `Input` adapter, tag→bucket map, per-language fold allow-lists, JSON (`@lezer/json`) + TS/JS (`@lezer/javascript`) providers. Deps only core + `@lezer/*`. |
| RD-03 | Editor view features (`@jsvision/editor`) | [RD-03](requirements/RD-03-editor-view-features.md) | — | RD Drafted | ✏️ | 2026-07-18 | Highlight render, gutter/line-numbers, folding UX (gutter-click + menu + Ctrl-K), bracket-match, comment-toggle, Tab indent, large-file soft-cap/degrade. Depends #101 (extraction). |
| RD-04 | Non-functional (perf, packaging, security, testing) | [RD-04](requirements/RD-04-non-functional.md) | — | RD Drafted | ✏️ | 2026-07-18 | Perf NFR (16ms, off-CI, non-gating) + the scoped validation probe (sets the soft-cap threshold, runs early), zero-dep/packaging, hostile-content security, testing + kitchen-sink gates. |

**Suggested order:** #101 → RD-01 → RD-02 → RD-04's probe (early) → RD-03 → RD-04. Next: `make_plan` for RD-01.
