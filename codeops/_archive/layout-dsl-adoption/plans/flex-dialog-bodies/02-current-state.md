# 02 — Current State

> **Plan**: layout-dsl-adoption/flex-dialog-bodies
> Grounded map (file:line + verbatim structure) of every target site and its oracle, as of branch
> `feat/dsl-adoptation` (after #113 hardening + #122 tree-order `Tab`).

## DSL primitives available (view/dsl)

- `at(view, x,y,w,h | rect)` — `absolute.ts:39`: sets `position:'absolute'`+`rect`, merge-preserving, out-of-flow. The blessed absolute escape hatch.
- `cover(view)` — `absolute.ts:69`: sets `position:'fill'`, merge-preserving; overlays the parent content box, reserves no flow space, re-solves on resize. **The collapse guard** for all-absolute-child bodies.
- `center(view, w, h)` — `absolute.ts:93`: absolute origin rect + `centered=true`.
- `col(...)` / `row(...)` — `flex.ts:125/145`: build a `Group` with `direction` set; accept an optional `Flex` props object first (`{ padding, gap, justify }`), skip falsy children, add the rest **in order**.
- `grow(view, n, {min})` — `flex.ts:170`: `size:{kind:'fr',weight:n}`.
- `fixed(view, n)` — `flex.ts:190`: `size:{kind:'fixed',cells:n}`.

`col`/`row` nest `Group`s → tab traversal across them relies on the shipped **tree-order `Tab`** (#122).

## Target 1 — `packages/ui/src/dialog/message-box.ts`

Local helpers (to delete): `at` (`:58`), `centerX` (`:64`), `PAIR_WIDTH` (`:55`). Keep `BUTTON` (`:54`) — still referenced (`BUTTON.height`).
Each dialog is `new Dialog({…, centered:true})` then `dlg.layout = {...dlg.layout, padding:0}` then flat
absolute children:

- **`messageBox`** (`:101`) — width `min(60, max(hasCancel?40:24, text.length+6))`, height `hasCancel?9:7`. Children: `Text` at `{3,2,w-6,h}`; OK-only → OK at `{centerX(w,10),buttonY,10,2}`; okCancel → OK at `{startX,…}` + Cancel at `{startX+12,…}`. Child add-order → focusable **[OK]** or **[OK, Cancel]**.
- **`confirm`** (`:132`) — width `min(60,max(40,len+6))`, height 9. `Text` `{3,2,w-6,2}`; Yes `{startX,6,10,2}`; No `{startX+12,6,10,2}`. Focusable **[Yes, No]**.
- **`inputBox`** (`:158`) — width `min(60,max(40,label.length+6))`, height 9. `Input` added **first** at `{3,3,w-6,1}`; `Label` `{3,2,w-6,1}`; OK `{startX,6,…}`; Cancel `{startX+12,6,…}`. Focusable **[Input, OK, Cancel]** (Label non-focusable).

**Oracles (both SURVIVE — no child-rect asserts):**
- `test/message-box.spec.test.ts` — 7 tests, all assert only the resolved promise value (ok/cancel/true/false/entered/null).
- `test/message-box.impl.test.ts` — 5 tests: `activeWindow().bounds.width` = 24/40/60 (the **dialog width formula**, not a child), the invalid-OK veto+refocus, and Esc→cancel. No child rects.

## Target 2 — `packages/ui/src/editor/dialogs.ts`

Local helpers (to delete): `tv` (`:33`), `at` (`:38`). Each dialog is `padding:0` + flat absolute children.

- **`findDialog`** (`:56`) — Dialog 38×12. `Input` `tv(3,3,32,4)`; `Label` `tv(2,2,15,3)`; `History` `tv(32,3,35,4)` (right of input); `CheckGroup` `tv(3,5,35,7)`; OK `tv(14,9,24,11)`; Cancel `tv(26,9,36,11)`. Focusable **[Input, History, CheckGroup, OK, Cancel]**.
- **`replaceDialog`** (`:95`) — Dialog 40×16. `findInput` `tv(3,3,34,4)` + `Label` + `History`; `newInput` `tv(3,6,34,7)` + `Label` + `History`; `CheckGroup` `tv(3,8,37,12)`; OK `tv(17,13,27,15)`; Cancel `tv(28,13,38,15)`. Focusable **[findInput, History, newInput, History, CheckGroup, OK, Cancel]**.
- **`confirmBox`** (`:146`) — Dialog `min(60,max(40,len+6))`×9. `Text` `{3,2,w-6,2}`; Yes `{3,6,10,2}`; No `{15,6,10,2}`; Cancel `{27,6,10,2}`. Focusable **[Yes, No, Cancel]**.
- **`replacePrompt`** (`:184`) — Dialog **explicit** `rect:{x,y,40,7}` (caret-anchored, **keep-absolute outer**). Inner: `Text` `{3,2,34,1}`; Yes `{3,4,10,2}`; No `{15,4,…}`; Cancel `{27,4,…}`. Focusable **[Yes, No, Cancel]**.

**Oracle `test/editor-dialogs.spec.test.ts`:**
- **RE-BASELINE** — `:51` findDialog child rects (`input` L63, `cluster` L65, `buttons` L67-70); `:89` replaceDialog child rects (`inputs` L106-109, `cluster` L111, `buttons` L113-116). The dialog **outer** `bounds.width/height` (38/12, 40/16) and the record round-trips **survive**.
- **SURVIVE** — `:80` (cancel→null), `:123` (replacePrompt **outer** bounds `{10,1,40,7}` / dropped `y=11`), `:145` (infoBox), `:153` (confirmBox yes/no/cancel).

## Target 3 — `packages/forms/src/form-dialog.ts`

Local helpers (to delete): `place` (`:59`), `buttonRects` (`:65`), `PAIR_WIDTH` (`:56`). Keep `BUTTON`/`GAP` (`:54-55`) — still referenced by the band's `at()` rect.
`formDialog` (`:194`) builds the caller's opaque `body`, then:
- `cover(body)` (`:227`) — **keep** (the zero-width-collapse guard; comment `:222-226`).
- `dlg.add(place(ok, rects.ok))` (`:229`) and `dlg.add(place(cancel, rects.cancel))` (`:235`) — the OK/Cancel pair at a centered bottom row (`buttonRects` centers `PAIR_WIDTH` at `y=height-BUTTON.height-1`). `cancel.grabsFocus=false` (`:234`) — **keep** (no-focus-steal on click).

**Oracle `test/form-dialog.impl.test.ts`:**
- **RE-BASELINE** — `:80` (`impl: OK + Cancel are absolutely placed as a centered pair on one row`): asserts `position==='absolute'` (L95) + same-row + a 12-cell x-gap (L96-98). Re-derive to the flex-row geometry (no `position:'absolute'` on the buttons; centered pair preserved).
- **SURVIVE** — `:59` (focus lands on first focusable body view), `:104` (`bodyGroup.bounds.width>0` + paint — the collapse regression guard), `:139` (Cancel discards without validating), `:184` (OK greys during submit).
- `test/form-dialog.spec.test.ts` (14) + `test/form-dialog-security.spec.test.ts` — **all survive**.

## Dependency + risk notes

- **#122 tree-order `Tab` (shipped)** makes the new nested `col`/`row` groups keyboard-traversable; without it these rebuilds would relocate the group-scoped dead-end. This is the reason #115 was blocked on #122.
- **Collapse footgun:** an opaque body of all-absolute children under `grow()` in a `col` collapses its cross-axis to 0 → `formDialog` keeps `cover(body)` (AR-2). The ui/editor bodies use `cover(col(...))` where the `col` has in-flow children → no collapse (AR-3).
- **No public-JSDoc change** → no plugin API-ref drift (the exported symbols keep their signatures/JSDoc; only non-exported local helpers are deleted).
