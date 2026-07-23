# 01 — Requirements & Scope

> **Plan**: layout-dsl-adoption/flex-dialog-bodies
> **Source**: [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md), [RD-02](../../requirements/RD-02-non-functional-and-verification.md)
> **Implements**: RD-01 FR-1/FR-2/FR-3/FR-5/FR-8 (ui/forms Tier-2 subset), RD-02 NFR-1/NFR-2/NFR-3/NFR-5/NFR-6/NFR-7

## Objective

Replace hand-computed absolute child geometry with flex composition in the `@jsvision/ui` and
`@jsvision/forms` dialog **bodies**, deleting the local coordinate helpers, while keeping every
behavioral, focus, validation, color, and security contract identical. Child positions may diverge from
Turbo Vision; that divergence is the recorded, intentional decision (RD-01).

## Functional requirements (this plan)

- **R-1 — messageBox family flex rebuild.** `messageBox`/`confirm`/`inputBox` (`ui/dialog/message-box.ts`)
  compose their body with `cover(col(…))` + a centered button `row`; the local `at`/`centerX`/`PAIR_WIDTH`
  are deleted. The dialog **width/height formula is unchanged** (message-box.impl asserts it). (RD-01 FR-1/FR-2/FR-5)
- **R-2 — editor dialog flex rebuild.** `findDialog`/`replaceDialog`/`confirmBox` and the **inner body** of
  `replacePrompt` compose with `col` of label+input `row`s + a centered button `row`; the local `tv`/`at`
  are deleted. `replacePrompt`'s **outer** caret-anchored rect stays absolute (keep-absolute, FR-4). (RD-01 FR-1/FR-2/FR-4/FR-5)
- **R-3 — formDialog button flex.** `formDialog` (`forms/form-dialog.ts`) keeps `cover(body)` and places
  the OK/Cancel pair as `at(row({justify:'center',gap:2}, ok, cancel), bottomBand)`; the local
  `place`/`buttonRects`/`PAIR_WIDTH` are deleted. (RD-01 FR-1/FR-2/FR-5; AR-2/AR-4)
- **R-4 — Tab order preserved + proven.** Each rebuilt dialog carries a traversal-order spec test asserting
  its ordered focusable-descendant list equals the pre-conversion order, written green-on-current-code
  first and green after the rebuild. (RD-01 FR-3, RD-02 NFR-2; depends on #122 tree-order `Tab`)
- **R-5 — Oracle re-derivation per NFR-3.** Only these geometry oracles are edited, each PR-recorded as a
  deliberate re-derivation citing RD-01: `editor-dialogs.spec:51,89` (child rects) and `form-dialog.impl:80`
  (button block). Every behavioral + security oracle passes **unedited**. (RD-01 FR-8, RD-02 NFR-1/NFR-3/NFR-6)
- **R-6 — Verify + performance non-regression.** `TUI_SKIP_PERF=1 yarn verify` green per phase; `yarn bench`
  no-regression (no new per-frame allocation on the resize path); `yarn lint:fix` before the PR-bound push.
  (RD-02 NFR-5/NFR-7)

## In scope

- `packages/ui/src/dialog/message-box.ts` (messageBox, confirm, inputBox — and the shared `runDialog`, untouched).
- `packages/ui/src/editor/dialogs.ts` (findDialog, replaceDialog, confirmBox, replacePrompt-inner; `infoBox`/`wireEditorDialogs` unchanged).
- `packages/forms/src/form-dialog.ts` (the OK/Cancel button placement only; the async gate + `cover(body)` untouched).
- New traversal-order spec tests (ui + forms); re-baselines of `editor-dialogs.spec` and `form-dialog.impl`.

## Out of scope

- **App-overlay `cover()`** (`application.ts:335/435`) + its ~7-file overlay-locator re-baseline — separate follow-up task under #115 (AR-1).
- `@jsvision/files` dialogs + `grow-dialog.ts`/`grow.ts` deletion — **#120**.
- Datagrid (#116), Tier-3 example/story/docs conversions (#110/#112), `setLayout` (#117).
- The CLAUDE.md carve-out — already present (Tier-0, AR-8).
- Any change to the dialog width/height sizing formulas, validators, async gate, theming, or the `replacePrompt` anchor formula.

## Success criteria (definition of done)

1. R-1/R-2/R-3 implemented; the local `at`/`tv`/`place`/`centerX`/`PAIR_WIDTH`/`buttonRects` helpers are gone from the three files (`grep` returns none in those files).
2. Each rebuilt dialog has a traversal-order spec asserting the pre-conversion focusable order, green after the rebuild (R-4).
3. `message-box.spec` + `.impl`, `form-dialog.spec`, `form-dialog-security.spec`, and every non-geometry test pass with **assertions unedited**; the only **geometry-oracle** edits are `editor-dialogs.spec:51,89` and `form-dialog.impl:80`, each PR-noted as a deliberate re-derivation citing RD-01. `form-dialog.impl:80/139/184` additionally take a behavior-preserving **button-locator swap** (`dlg.children.filter` → a `descendants()` walk), forced because the flex button band nests OK/Cancel one level deeper — a mechanical test-plumbing change that alters no assertion (see preflight PF-001). (R-5)
4. `TUI_SKIP_PERF=1 yarn verify` green; `yarn bench` no-regression; `yarn lint:fix` clean (R-6).
5. `forms-dialog.story.ts` still renders clean (no clipping/color regression) — a recorded manual/headless check (AR-11, NFR-4 spirit); and the messageBox/confirm/inputBox family carries a headless paint guard (the `form-dialog.impl:104` collapse-guard pattern) asserting a known body string paints and every button solves to non-zero `bounds` (see preflight PF-002).
6. The app-overlay follow-up is recorded as a task row on the feature roadmap (AR-1).
