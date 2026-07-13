# 03-03 — MenuBar Flexible-Title Layout

> Implements F-6, F-7. Decisions: AR-1, AR-5, AR-6, AR-7, AR-8, AR-19. References current state 02 §
> "MenuBar".

## Scope (AR-1)

Layout only. Give the menu **titles** right-alignment + flexible gaps; keep them as **data** nodes
(no child-view conversion), keep the navigation/popup state machine intact, and thread the
flex-computed title x into the controller so submenu popups still anchor under the right title.
**Embedded passive widgets in the menu bar are out of scope** (deferred).

## The elegant lever: everything already flows through `layoutTitles`

`MenuBar.draw`, `titleIndexAt` (hit-test), and the controller's popup anchor **all** read a title's
`x`/`width` from `layoutTitles()` (02 § MenuBar). So if `layoutTitles` produces flex-correct x's, all
three adapt for free. The refactor is therefore concentrated in one function plus a new data node.

## New data node — `menuSpacer()` (AR-5, AR-19)

Add a `MenuItem` variant the layout treats as flexible and draw/hit-test/nav **skip**:

```ts
type MenuItem =
  | { kind: 'item'; title: string; command: string; key?: string }
  | { kind: 'sub'; title: string; items: MenuItem[] }
  | { kind: 'separator' }
  | { kind: 'spacer'; weight?: number };   // NEW — flexible gap between titles

/** Insert a flexible gap between menu titles; the following titles are pushed toward the right edge. */
function menuSpacer(weight = 1): MenuItem;   // NEW builder, barrel-exported
```

- `titleOf` returns `''` for a spacer (never a title); `menuItemHotkey`/`menuItemLabel` return `''`
  (no accelerator, not a nav target) — so `menuSpacer` is naturally skipped by the controller's
  ←→/hotkey walks, which already skip non-title nodes.

## `layoutTitles` becomes width-aware (AR-7, AR-8)

```ts
/**
 * Place the top-level titles left-to-right as ` name ` buttons. With `barWidth` given and one or more
 * `menuSpacer` nodes present, flexible gaps absorb the leftover width (right-alignment). With no
 * `barWidth` (or no spacer) the result is the classic left-pack from column 1 — byte-identical.
 */
function layoutTitles(tops: readonly MenuItem[], barWidth?: number): TitleLayout[];
```

- Build the segment list: each title → `{kind:'fixed', width: text.length + TITLE_PAD}`; each
  `menuSpacer` → `{kind:'flex', weight}`. Feed `packRow(segments, barWidth, TITLE_MARGIN)` (03-01).
- **Default preserved (AR-7):** `barWidth` omitted **or** no spacer ⇒ `packRow` left-packs from
  `TITLE_MARGIN` (=1) exactly as today; the `layoutTitles + titleIndexAt` impl oracle stays green.
- `TitleLayout` still `{ index, x, width, label }` — spacers are **not** emitted as titles (they carry
  no index/label), so downstream consumers see the same shape, just with shifted x's.
- `titleIndexAt(tops, x, barWidth?)` gains the same optional `barWidth` and packs identically, so a
  click on a right-aligned title maps to its index and a click in the flexible gap maps to `null`.

## Threading the bar width (AR-8)

Three call sites pass the bar width (the full row width = viewport width):

1. **`MenuBar.draw`** — already has `ctx.size.width`; pass it: `layoutTitles(this.items, ctx.size.width)`.
2. **`MenuBar` mouse hit-test** — the click path uses `titleIndexAt`; pass the bar width (from the
   view's own bounds / the dispatch context).
3. **`MenuController.openTop`** (controller.ts:197) — pass the bar width. The controller already has the
   overlay/viewport rect (`viewport()`); the bar spans the full viewport width, so use
   `viewport().width`. `layoutTitles(tops, width)[index].x` then anchors the popup under the moved title.

`MenuBar` stays `extends View` (no class change) — only its geometry source changes, so
`menuBar([...]) instanceof MenuBar` and the popup oracles are unaffected.

## Files

- `packages/ui/src/menu/builders.ts` — `MenuItem` spacer variant, `menuSpacer()`, width-aware
  `layoutTitles`/`titleIndexAt`, `packRow` (or import from 03-01's module).
- `packages/ui/src/menu/menubar.ts` — pass `ctx.size.width` to `layoutTitles`; pass width in the click
  hit-test.
- `packages/ui/src/menu/controller.ts` — `openTop` passes `viewport().width` to `layoutTitles`.
- `packages/ui/src/menu/index.ts` — export `menuSpacer` (additive).

## Non-goals (unchanged)

- Popup width/box/shadow/right-aligned-key drawing (the TV fidelity oracles) — untouched.
- ↑↓/←→/Esc/Enter/hotkey nav — untouched (spacers are skipped by the existing non-title filter).
