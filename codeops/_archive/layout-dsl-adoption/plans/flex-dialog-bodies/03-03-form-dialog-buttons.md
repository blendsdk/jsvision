# 03-03 — Component: formDialog buttons

> **File**: `packages/forms/src/form-dialog.ts` · **Implements**: R-3, R-4, R-5 · **Oracle**: re-baseline `form-dialog.impl:80` (AR-6)

## Goal

Replace the two `place(ok/cancel, buttonRects(...))` calls with a single centered `row` band, deleting the
local `place` / `buttonRects` / `PAIR_WIDTH` helpers. **`cover(body)` stays** — the opaque caller body is
the all-absolute-children case that collapses under `grow()` in a `col` (AR-2, the recorded footgun). Only
the button pair moves to flex.

## Target structure

Import the blessed DSL `at`, plus `row`, from `@jsvision/ui`. Keep everything else in `formDialog`
(`form-dialog.ts:194`) — the async gate, `cover(body)` at `:227`, `cancel.grabsFocus=false` at `:234`.

```ts
import { at, row } from '@jsvision/ui';

const BUTTON = { width: 10, height: 2 } as const;
const GAP = 2;

// …inside formDialog, after cover(body) / dlg.add(body):
const cancel = cancelButton();
cancel.grabsFocus = false; // keep: no focus-steal on click (avoids the one-frame red error flash)

const buttonBand = row({ justify: 'center', gap: GAP }, ok, cancel);
// One blessed DSL at() anchors the band to the second-to-last row — the sanctioned dialog-frame anchor.
at(buttonBand, { x: 0, y: options.height - BUTTON.height - 1, width: options.width, height: BUTTON.height });
dlg.add(buttonBand);
```

- `row({ justify:'center', gap:2 })` centers the OK/Cancel pair — replaces the `buttonRects` `startX`
  centering + `PAIR_WIDTH`. The band spans the full dialog width, so `justify:'center'` centers the pair
  exactly as `buttonRects` did (deliberate divergence is allowed, but this reproduces the centered look).
- The single **DSL** `at()` (`view/dsl/absolute.ts:39`, the blessed escape hatch) replaces the two local
  `place()` calls; the local `place`/`buttonRects`/`PAIR_WIDTH`/`GAP`/`BUTTON` module helpers
  (`form-dialog.ts:54-72`) are deleted (FR-5). Keep a local `BUTTON`/`GAP` const only if still referenced.
- The button band is an out-of-flow overlay (from `at`), added **after** `body` → it paints on top of the
  covering body, exactly like the two `place()`d buttons do today.

## Why not `col(grow(body), fixed(buttonRow))` (rejected — AR-2)

The caller body is opaque and typically all-absolute children (`form-dialog.ts:222-226`). In a `col`,
`grow(body)` leaves the body's **width** on the `auto` cross-axis → it collapses to 0 and clips every
child (the shipped zero-width-collapse regression that `cover(body)` fixed, guarded by `form-dialog.impl:104`).
So the body must stay `cover()`; the buttons flex independently as a bottom band.

## Oracle handling — `test/form-dialog.impl.test.ts`

### Button-locator caveat (PF-001) — three tests need a mechanical locator swap

Wrapping OK/Cancel in the `row` band makes them **grandchildren** of the dialog (children of the band
`Group`, which is the dialog's child). Every test that finds a button via the **shallow**
`dlg.children.filter(c => c instanceof Button)` therefore returns `[]` and must switch to a recursive
`descendants()` walk (the pattern `message-box`/`editor-dialogs` tests already use). This is a
behavior-preserving **test-locator** update — *how* a button is found, not *what* is asserted — and is
**distinct** from the one RD-01 geometry re-baseline below (it must not be counted as an NFR-3 oracle
edit). It touches three tests:

- **`:80`** (L92) — swap the lookup to `descendants()`; then `buttons.length===2` (L93) holds again.
- **`:139`** (L166) — swap the `dlg.children.filter(...)[1]` Cancel lookup to `descendants()`; otherwise
  `originOf(undefined)` throws. **Assertions unchanged.**
- **`:184`** (L203) — swap the lookup to `descendants()`; otherwise `buttons` is `[]` and L211 fails.
  **Assertions unchanged.**

### Geometry re-baseline (R-5, NFR-3) — `form-dialog.impl.test.ts:80`

**Spec-first:** rewrite the button block first (red), then implement. Record in the commit body the
deliberate re-derivation citing RD-01.

- Current (L95-98): asserts `buttons.every(b => b.layout.position === 'absolute')` **and** the same-row +
  12-cell x-gap. Under the flex `row`, the individual buttons are flow children of the band (no
  `position:'absolute'` on the buttons themselves) and carry **no static `layout.rect`** — their geometry
  is the solved `bounds`, so add a `renderRoot.flush()` before reading it. Re-derive to assert the
  **behavioral** intent that survives divergence: two buttons, same row (`bounds.y` equal), OK left of
  Cancel, centered as a pair — computed from the solved `bounds` of the band's children, not a `position`
  predicate.
- **Do not touch the assertions in** `:59`, `:104` (`bodyGroup.bounds.width>0` collapse guard — must stay
  green, proving `cover(body)` held), `:139`, `:184`, nor any of `form-dialog.spec` (14) /
  `form-dialog-security.spec`. `:139`/`:184` keep every assertion; only their button-locator line changes
  (above).

## Invariants to preserve (FR-2)

- The async submit gate, seal-during-submit, `valid(quit)` veto, form disposal — untouched.
- OK `default:true` + `disabled:()=>form.submitting()`, `cancel.grabsFocus=false` — untouched.
- Focusable order: body focusables → OK → Cancel (Cancel Tab-reachable, Esc works) — proven by the traversal check (R-4; `form-dialog.impl:59` already covers first-focusable).

## Verification

- `form-dialog.impl:80` re-baselined + green; `:59`/`:104` + all 14 `form-dialog.spec` + security **unedited**; `:139`/`:184` **assertions unedited** (button-locator swap only — PF-001).
- Traversal preserved (existing `:59` first-focusable + a focus-sequence assertion through OK/Cancel).
- **Rebuild `@jsvision/ui` before** running `@jsvision/forms` / `@jsvision/examples` tests (the "examples consume built ui" gotcha).
- No local `place`/`buttonRects`/`PAIR_WIDTH` left (`grep`); `forms-dialog.story.ts` renders clean.
