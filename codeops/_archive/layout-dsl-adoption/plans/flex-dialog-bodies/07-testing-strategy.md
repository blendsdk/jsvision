# 07 — Testing Strategy

> **Verification contract**: [RD-02](../../requirements/RD-02-non-functional-and-verification.md).
> **Posture:** behavior-invariant rebuild. Behavioral + security oracles pass **unedited** (NFR-1/NFR-6);
> the RD-01 re-derivation exception (NFR-3) applies to exactly **two** geometry blocks. New per-dialog
> **traversal-order** specs (NFR-2) are written **green-on-current-code first**, then must stay green.

## Three-part discipline

1. **New traversal oracles (NFR-2).** One spec per dialog family asserting the ordered focusable-descendant
   list = the pre-conversion order. Written green-on-current-code (characterizing today), kept green through
   the rebuild. These are the proof that nested `col`/`row` groups + tree-order `Tab` (#122) preserve tab order.
2. **Witness oracles (survive unedited).** The proof behavior/sizing/return didn't change. Editing one to
   pass is a defect in the conversion, not the test.
3. **Geometry re-baselines (NFR-3, recorded).** Only `editor-dialogs.spec:51,89` and `form-dialog.impl:80`.
   Spec-first: rewrite the block to the intended flex geometry (red), then implement to green; PR-record the
   deliberate re-derivation citing RD-01.

## Test cases

| ST | Site | Assertion (input → expected) | File (status) | Trace |
|----|------|------------------------------|---------------|-------|
| **ST-T1** *(new)* | messageBox/confirm/inputBox | focusable order = `[OK]` / `[OK,Cancel]` / `[Yes,No]` / `[Input,OK,Cancel]` | new `message-box.traversal.spec.test.ts` (green-before + after) | R-4, NFR-2 |
| **ST-T2** *(new)* | find/replace/confirmBox/replacePrompt | orders `[Input,History,CheckGroup,OK,Cancel]` / `[findInput,History,newInput,History,CheckGroup,OK,Cancel]` / `[Yes,No,Cancel]` / `[Yes,No,Cancel]` | new `editor-dialogs.traversal.spec.test.ts` (green-before + after) | R-4, NFR-2 |
| **ST-T3** *(new/extend)* | formDialog | focus lands on first body focusable, then Tab reaches OK → Cancel | extend `form-dialog.impl:59` or new `form-dialog.traversal.spec` | R-4, NFR-2 |
| **ST-R1** *(re-baseline)* | findDialog | `input`/`cluster`/`buttons` `.layout.rect` = the values the 38×12 `col`/`row` tree solves to | `editor-dialogs.spec:51` (L63/L65/L67-70 re-derived) | R-5, NFR-3 |
| **ST-R2** *(re-baseline)* | replaceDialog | `inputs`/`cluster`/`buttons` `.layout.rect` = the 40×16 flex-tree values | `editor-dialogs.spec:89` (L106-116 re-derived) | R-5, NFR-3 |
| **ST-R3** *(re-baseline)* | formDialog buttons | 2 buttons, same `bounds.y`, OK left of Cancel, centered pair — **no** `position:'absolute'` predicate | `form-dialog.impl:80` (L95-98 re-derived) | R-5, NFR-3 |
| **ST-W1** | messageBox family | width formula 24/40/60; ok/cancel/true/false/value/null; invalid-OK veto+refocus; Esc→cancel | `message-box.spec` (7) + `.impl` (5) — **unedited** | R-1, NFR-1 |
| **ST-W2** | editor dialogs | cancel→null; replacePrompt **outer** bounds `{10,1,40,7}` / dropped `y=11`; infoBox; confirmBox yes/no/cancel | `editor-dialogs.spec:80/123/145/153` — **unedited** | R-2, NFR-1 |
| **ST-W3** | formDialog | 14 behavior/return/gate specs; first-focusable, `bodyGroup.bounds.width>0` collapse guard, cancel-no-validate, OK-greys | `form-dialog.spec` (14) + `form-dialog.impl:59/104` — **unedited**; `:139/:184` — **assertions unedited** (button-locator swap only, PF-001) | R-3, NFR-1 |
| **ST-W4** | Security | input-validation / validator / sanitization oracles for the touched dialogs | `form-dialog-security.spec` + input/validator specs — **unedited** | NFR-6 |
| **ST-K1** | Render | `forms-dialog.story` mounts headlessly + paints ≥1 cell (no clipping/color regression) — recorded manual note | `kitchen-sink.smoke.spec` (unedited) + manual pass | AR-11, NFR-4 |
| **ST-K2** *(new)* | messageBox / confirm / inputBox | mount headless, `flush()`, a known body string paints **and** every button solves to non-zero `bounds` (no clip/collapse) — the `form-dialog.impl:104` guard applied to the family with **no** child-rect oracle | new `message-box.render.impl.test.ts` (green-before + after) | PF-002, NFR-4 |
| **ST-P1** | Perf | no new per-frame allocation on the resize path; `yarn bench` reports nothing past 16 ms off-CI | `yarn bench` (informational) | R-6, NFR-5 |

## Why these are the only new tests

- **ST-T1/T2/T3** are mandated by NFR-2 — the tab order is the one behavior most at risk when flat absolute
  children become nested `col`/`row` groups, so each family gets an explicit ordered-focusable oracle,
  green-on-current-first so it characterizes today's order before the rebuild.
- **No new geometry oracle** beyond the two NFR-3 re-baselines — message-box asserts no child rects, so its
  rebuild needs none; the divergent child positions elsewhere are intentionally unasserted except where a
  pre-existing oracle already pinned them (the two re-baselines).

## Verification per phase

`TUI_SKIP_PERF=1 yarn verify` at each phase boundary. Inner loop: `yarn workspace @jsvision/ui test`
(Phases 1-2); **rebuild `@jsvision/ui`** then `yarn workspace @jsvision/forms test` + `@jsvision/examples test`
(Phase 3-4 — the "examples consume built ui" gotcha). Final gate before the PR-bound push: `yarn lint:fix`
then `TUI_SKIP_PERF=1 yarn verify` green + `yarn bench` no-regression.

## Explicit non-goals

- No app-overlay tests (out of scope, AR-1).
- No new performance test — NFR-5 is non-regression only.
- No spec-oracle **assertion** edits beyond ST-R1/R2/R3 — any other behavioral test that goes red is a
  conversion defect. The lone exception is the mechanical **button-locator swap** in `form-dialog.impl:80/139/184`
  (`dlg.children.filter` → `descendants()`), forced by the band nesting the buttons one level deeper; it
  changes no assertion (PF-001) and is not an NFR-3 geometry re-baseline.
