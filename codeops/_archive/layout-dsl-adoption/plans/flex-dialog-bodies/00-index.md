# Plan: Flex-Eliminate the ui/forms Dialog Bodies (Tier 2, deliberate divergence)

> **Feature**: layout-dsl-adoption · **Plan**: flex-dialog-bodies
> **Implements**: layout-dsl-adoption/RD-01 (Tier-2 ui/forms slice) · **Verification**: layout-dsl-adoption/RD-02
> **Source**: [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md), [RD-02](../../requirements/RD-02-non-functional-and-verification.md)
> **GitHub**: #115 (ui/forms dialog family) · **Depends on**: #122 (tree-order `Tab`, shipped) · **Kind**: Rebuild (deliberate TV-geometry divergence)
> **Status**: 🔎 Plan Preflighted (2026-07-19 — 6 findings, all resolved + fixed; see [00-preflight-report.md](00-preflight-report.md))
> **Created**: 2026-07-19
> **CodeOps Skills Version**: 3.9.0

## What this plan is

The **Tier-2** slice of the layout-DSL flex-elimination epic for the `@jsvision/ui` + `@jsvision/forms`
dialog **bodies** — the deliberate-divergence rebuilds that Tier-0 (`tier0-parity-safe`) deferred and
that were blocked on tree-order `Tab` traversal (#122, now shipped). It replaces hand-computed absolute
child geometry with flex composition (`cover`/`col`/`row`/`grow`/`fixed` + `justify:'center'`) in three
component families, deletes the local coordinate helpers, and re-derives exactly the geometry oracles
the RD-02 NFR-3 protocol sanctions — no more.

Behavior is invariant (FR-2): content, signals, keyboard/mouse, validation, colors, return values, and
**tab-traversal order** are unchanged. Only child positions may diverge from Turbo Vision, and that is
the recorded, intentional decision (RD-01; already carved out in `CLAUDE.md:186-192`).

## Scope at a glance

**In:**
1. **`messageBox` / `confirm` / `inputBox`** (`ui/dialog/message-box.ts`) → `cover(col(…, fixed(row({justify:'center'}, …buttons))))`; delete local `at` / `centerX` / `PAIR_WIDTH`. **Oracle: survives** (message-box.spec + .impl assert only the width formula + return/focus/validity).
2. **`findDialog` / `replaceDialog` / `confirmBox` / `replacePrompt`-inner** (`ui/editor/dialogs.ts`) → `col` of label + input `row`s + a centered button `row`; delete local `tv` / `at`; `replacePrompt`'s **outer** rect stays absolute (keep-absolute). **Oracle: re-baseline** `editor-dialogs.spec:51,89` child rects; L123/L145/L153 survive.
3. **`formDialog` buttons** (`forms/form-dialog.ts`) → `at(row({justify:'center',gap:2}, ok, cancel), bottomBand)`; **keep `cover(body)`**; delete local `place` / `buttonRects` / `PAIR_WIDTH`. **Oracle: re-baseline** `form-dialog.impl:80`; the other 4 `.impl` + all 14 `.spec` + security survive.
4. A **per-dialog traversal-order spec test** (NFR-2), written green-on-current-code first, proving tab order is preserved.

**Out (tracked separately):**
- The **app-overlay `cover()`** conversion (`application.ts:335/435`, PA-1) + its ~7-file overlay-locator re-baseline — a separate follow-up task under #115 (AR-1, user decision).
- The `@jsvision/files` dialogs + `grow-dialog.ts` deletion (**#120**), datagrid (#116), Tier-3 demos (#110/#112).
- The CLAUDE.md carve-out — **already present** (Tier-0), no work here (AR-8).

## The change in one paragraph

Each dialog currently places every child at a hand-computed `{position:'absolute', rect}` on a
`padding:0` `Dialog`, using a local `at`/`tv`/`place` helper plus `centerX`/`PAIR_WIDTH`/`buttonRects`
math. This plan replaces that with a single `cover(col(...))` (ui/editor) or a `cover(body)` + centered
button `row` band (forms): the `col` distributes rows and a `fixed` button band inside the frame, and
`row({justify:'center', gap:2})` centers each button pair — deleting the coordinate helpers entirely.
Because `col`/`row` build nested `Group`s, tab order now rides on the shipped tree-order `Tab` primitive
(#122); a per-dialog traversal spec (green-on-current-first) locks the order. Message-box needs **no**
oracle edit; editor + forms each re-baseline exactly one geometry block (NFR-3), PR-recorded as a
deliberate re-derivation citing RD-01.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — 11 decisions resolved (✅ passed) |
| [01-requirements.md](01-requirements.md) | Scope, in/out, success criteria, RD trace |
| [02-current-state.md](02-current-state.md) | Grounded current-state map (file:line + code) of every target + oracle |
| [03-01-message-box.md](03-01-message-box.md) | Component spec — `messageBox`/`confirm`/`inputBox` flex rebuild |
| [03-02-editor-dialogs.md](03-02-editor-dialogs.md) | Component spec — `findDialog`/`replaceDialog`/`confirmBox`/`replacePrompt`-inner rebuild + oracle re-baseline |
| [03-03-form-dialog-buttons.md](03-03-form-dialog-buttons.md) | Component spec — `formDialog` button flex + oracle re-baseline |
| [07-testing-strategy.md](07-testing-strategy.md) | Traversal oracles (NFR-2), witness set, re-baseline protocol, verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, progress checklist |

## Execution order

Phase 1 (message-box — zero oracle edits, proves the idiom) → Phase 2 (editor dialogs — one re-baseline)
→ Phase 3 (formDialog buttons — one re-baseline) → Phase 4 (non-regression sweep, render check, wrap +
record the app-overlay follow-up task). Spec-first throughout; the RD-01 re-derivation exception applies
only to the two geometry blocks in Phases 2–3.

**To execute:** use the exec_plan skill on `flex-dialog-bodies`.
