# 07 — Testing Strategy

> **Verification contract**: [RD-02](../../requirements/RD-02-non-functional-and-verification.md).
> **Posture (PA-7):** this slice is a behavior-invariant refactor, so the discipline is
> **characterization / witness** — existing oracles pass **unedited** (RD-02 NFR-1), and two new
> gap-filling tests are written **green-on-current-code first**, then must stay green through the swap.
> **No `*.spec.test.ts` is edited in this plan.**

## Two-part discipline

1. **Witness oracles (must pass unedited).** The proof that behavior/geometry did not change is that
   these keep passing without a single edit. Editing one to make it pass is a defect in the
   conversion, not the test.
2. **Gap-filling characterization tests (new).** Two sites have thin coverage (base-Dialog layout
   *shape* incl. `padding`; menu-catcher dismiss *after resize*). Add a test that is green on current
   code (correctly characterizing today's behavior), then confirm it is still green post-swap.

## Specification / witness test cases

| ST | Site | Assertion (input → expected) | Test file (status) | Trace |
|----|------|------------------------------|--------------------|-------|
| ST-1 | Base Dialog | sized (w=30,h=10), no rect, viewport 60×18 → `bounds.x===15`, `bounds.y===4`, size preserved | `dialog.centering.spec.test.ts:35-44` (witness, unedited) | R-1 |
| ST-2 | Base Dialog | explicit `rect:{2,1,..}` → honored verbatim, `bounds.x===2,y===1`, `centered===false` | `dialog.centering.spec.test.ts:48-54` (witness) | R-1 |
| ST-3 | Base Dialog | `centered:false` sized → stays at origin `{0,0}`; `centered:true` + explicit rect → re-centers | `dialog.centering.spec.test.ts:58-74` (witness) | R-1, PA-6 |
| ST-4 | Base Dialog | centered dialog: `bounds` re-centers while `layout.rect==={0,0,w,h}` + `centered===true`; commit-on-grab freezes rect + clears `centered` | `dialog.resize.impl.test.ts:44-89` (witness) | R-1 |
| ST-5 | formDialog body | body fills interior (`bodyGroup.bounds.width>0`) + bound value paints (no zero-width collapse) | `form-dialog.impl.test.ts:104-133` (witness) | R-2 |
| ST-6 | Dropdown popup | frame anchored+clamped (`rect.y===16`,`height===3`); list+catcher unmounted on dismiss | `popup.spec.test.ts:120-166` (witness) | R-4 |
| ST-7 | Menu | F10 / title click / Alt+F open the File popup in the overlay; outside click closes | `app-shell.menu.spec.test.ts:68+`, `app-shell.menu.impl.test.ts:144` (witness) | R-3 |
| ST-8 | App overlay (deferred) | overlay located via `position==='absolute'` with `rect==={0,0,vp}`; resize pushes a fresh frame | `app-shell.lifecycle.impl.test.ts:51,59,74`; `app-shell.menu.spec.test.ts:58-59` (witness) | PA-1 — **staying green proves the app overlay was NOT converted** |
| ST-9 **(new)** | Menu catcher | open a menu, resize the viewport, click outside the (now smaller/larger) bar → menu closes | new `menu-catcher.cover.impl.test.ts` (green-before + after) | R-3, PA-7, PA-8 |
| ST-10 **(new)** | Base Dialog shape | sized+no-rect → `layout` deep-equals `{position:'absolute',padding:1,rect:{0,0,w,h}}` & `centered===true`; explicit-rect branch keeps `padding:1` & `centered===false` | new `dialog.dsl-shape.impl.test.ts` (green-before + after) | R-1, PA-6 |
| ST-11 | Demos | each converted walkthrough/shell renders its expected output frame(s) | `shell-demo.e2e`, per-demo `*.e2e.test.ts`, `datagrid-showcase.walkthrough.spec` (witness) | R-5 |
| ST-12 | CLAUDE.md | `grep` finds the carve-out block naming all nine FR-1 dialog symbols | non-code artifact validation | R-6 |
| ST-13 | Security | input-validation / validator / file-path security oracles for the touched dialogs pass **unedited** | existing security specs (`form-dialog-security.spec`, input/validator specs) (witness) | RD-01 §Security, RD-02 NFR-6 |

## Why ST-9 and ST-10 are the only new tests

- **ST-10** pins the exact `layout` *descriptor* (including `padding:1`) that R-1's `center()`/`at()`
  swap must reproduce — the one place the swap could silently drop a field (PA-6). `dialog.centering`
  asserts *bounds*, not the raw descriptor; ST-10 closes that gap.
- **ST-9** pins the behavior that `menu/controller.ts`'s deleted `resize()` re-anchor provided:
  outside-click dismissal still works **after a viewport resize** once the catcher relies on
  `cover()` re-solving instead of manual re-anchoring. No existing test resizes then dismisses.

Both are `impl` tests (internals/characterization), not new spec oracles — consistent with "no spec
oracle edited," and written green-first so they characterize current behavior before the refactor.

## Verification per phase

Run `yarn verify` at each phase boundary. During the inner loop, per package:
`yarn workspace @jsvision/ui test` (Phases 1-2), `... @jsvision/forms test` (Phase 2),
`rebuild ui → yarn workspace @jsvision/examples test` (Phase 3). Final gate before any PR-bound push:
`yarn lint:fix` then `yarn verify` green + `check:deps` green.

## Explicit non-goals

- No new performance test — RD-02 NFR-5 is non-regression only; confirm no new per-frame allocation
  on the (unchanged in Tier 0) resize paths and that `yarn bench` reports nothing new past the 16 ms
  off-CI ceiling.
- No traversal-order spec tests — those are the Tier-2 dialog-rebuild deliverable (FR-3); Tier 0
  rebuilds no dialog body, so child add-order is unchanged.
