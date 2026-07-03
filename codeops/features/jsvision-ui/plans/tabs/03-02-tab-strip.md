# Tab-Strip Renderer: Tabs (RD-17)

> **Document**: 03-02-tab-strip.md
> **Parent**: [Index](00-index.md)

## Overview

`TabStrip` is the focusable `View` that draws the folder-tab strip and hit-tests clicks — the
renderer-split sibling of `tab-view.ts` (PA-4), mirroring `ListRows`/`GridRows`/`GridHeader`. It owns:
the notched tab-label draw (with the local glyph set), the active/inactive/disabled colouring, the
per-tab `×`, the `◄`/`►` overflow arrows + auto-scroll, and the click → (tab / close / arrow)
hit-test. Keeping this in its own file keeps `tab-view.ts` ≤500 (AC-12).

## Architecture

### Current Architecture
None. Closest precedent: `GridHeader extends View` (`table/grid-rows.ts:353`) — a sticky one-row
renderer that draws column headers and hit-tests header clicks to a column via `ev.local.x`
(`:424`).

### Proposed Changes
New `src/tabs/tab-strip.ts`:
- The **local glyph set** (PA-2/AR-184) — a small const with the same Unicode code points as
  `frame.ts`'s `SINGLE_BORDER` **plus** the tab-junction tees, decoded fresh at GATE-1.
- `TabStrip extends View` — `draw()` renders the strip; `onEvent()` hit-tests clicks + handles `←→`
  (when focused); exposes the current scroll offset + a `layout()`-style geometry pass shared with the
  hit-test so draw and hit-test never disagree.

## Implementation Details

### Local glyph set (GATE-1 decode target)

```ts
/**
 * Folder-tab box glyphs. Line/corner code points are identical to window/frame.ts SINGLE_BORDER
 * (kept local per PA-2 — frame.ts's consts are module-private and ship no tee). The tab-junction
 * tees are decoded fresh at GATE-1 (AR-184); CP437/Unicode citations recorded here at decode time.
 */
const TAB_GLYPHS = {
  h: '─',   // ─  (CP437 0xC4)
  v: '│',   // │  (CP437 0xB3)
  tl: '┌',  // ┌  (CP437 0xDA)
  tr: '┐',  // ┐  (CP437 0xBF)
  bl: '└',  // └  (CP437 0xC0)
  br: '┘',  // ┘  (CP437 0xD9)
  tdown: '┬', // ┬  tab meets frame-top (CP437 0xC2)   — GATE-1 tee
  tup: '┴',   // ┴  (CP437 0xC1)                        — GATE-1 tee
  tright: '├',// ├  (CP437 0xC3)                        — GATE-1 tee
  tleft: '┤', // ┤  (CP437 0xB4)                        — GATE-1 tee
} as const;
const OVERFLOW_LEFT = '◄';  // ◄
const OVERFLOW_RIGHT = '►'; // ►
const CLOSE_MARK = '×';     // ×
```

> **GATE-1 note:** the four tees are the *only* new glyph decode (line/corner reuse the shipped code
> points). The AFTER-diff task re-opens no TV class (none exists) but **verifies each rendered cell
> against `TAB_GLYPHS`** and confirms the CP437↔Unicode mapping, recorded in the JSDoc + commit.

### Strip geometry (shared by draw + hit-test)

A single pure pass computes, for the current `tabs`/`active`/`scrollOffset`/width:

```ts
interface TabSlot { index: number; x: number; labelW: number; closeX?: number; }
interface StripGeometry {
  slots: TabSlot[];          // visible tabs with on-strip x + width
  showLeftArrow: boolean;    // overflow left
  showRightArrow: boolean;   // overflow right
  leftArrowX: number; rightArrowX: number;
}
/** Compute visible slots + arrows; auto-scrolls so the active tab is fully visible (AR-176). */
function stripGeometry(tabs: Tab[], active: number, width: number, scrollOffset: number): StripGeometry;
```

- Each tab label = `` `~parsed title~` `` measured with `stringWidth` (shared measure), plus one leading
  `┬`/space notch and a trailing `×` cell when `closeable`.
- Overflow: when Σ labelW > strip width, set `showLeft/RightArrow` and clamp `scrollOffset` so the active
  slot is fully on-strip; off-screen slots are omitted (clipped). *(→ AC-9)*
- **draw()** consumes `StripGeometry`: for each slot, fill the label cells in
  `tabActive`/`tabInactive`/`tabDisabled`, draw the `~X~` hotkey letter in the hotkey style via
  `tildeSegments`, draw the `×` (closeable) and the notch tees; then draw the arrows if overflowing and
  the content-frame edges/corners around the interior. *(→ AC-2/3/7/8)*

### Hit-test (click → target)

```ts
/** Map a strip-local click to an action. Mirrors GridHeader.onEvent's local.x→column mapping. */
type StripHit =
  | { kind: 'tab'; index: number }
  | { kind: 'close'; index: number }
  | { kind: 'arrow'; dir: -1 | 1 };
function hitStrip(geo: StripGeometry, localX: number): StripHit | undefined;
```

`TabStrip.onEvent` (AR-179):
- mouse-down → `hitStrip`: `tab` → `view.select(index)`; `close` → `view.closeTab(index)`;
  `arrow` → step `scrollOffset` by ±1. *(→ AC-6/9)*
- `{left}`/`{right}` **when focused** → `view.prev()`/`view.next()`. *(→ AC-5)*
- Ctrl+PageUp/Down and Alt-hotkey are handled at the `TabView` level (global via `preProcess`, scoped
  to the focus-owning view by `isWithin` — PF-002, spec [03-01](03-01-tab-view.md)), not here. *(→ AC-4/8)*

### Integration Points
- **Draw:** all writes via RD-03 `DrawContext` (`ctx.text`/`ctx.fillRect`) → `ScreenBuffer` + `sanitize`
  (security boundary, AC-14). Width via the shared `stringWidth` measure (wide-glyph-safe).
- **Focus:** `TabStrip` is `focusable`; it is the `TabView`'s focus target (like `ListView.rows`).
- **Hotkeys:** `parseTilde`/`tildeSegments` (`menu/builders.ts`) render the marked letter; the
  Alt-accelerator table is built by `TabView` from the parsed titles.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Click in a strip gap / on the frame | `hitStrip` returns `undefined` → no-op | AR-179 |
| `scrollOffset` past the ends | clamped by `stripGeometry` so the active tab stays visible | AR-176 / AC-9 |
| Label wider than the whole strip | width-clipped to the strip; `◄`/`►` shown; never overflows viewport | security / AC-14 |
| Empty `tabs` | `slots = []`, no arrows; frame interior drawn empty | AC-15 |
| Wide (East-Asian) glyph in a title | measured with `stringWidth`; clip never splits a wide cell | security / AC-14 |

> **Traceability:** every strategy references the resolving AR entry (`00-ambiguity-register.md`).

## Testing Requirements
- Unit: `stripGeometry` (no-overflow, overflow both ends, auto-scroll keeps active visible, clip);
  `hitStrip` (tab / close / arrow / miss); glyph-set identity vs. the pinned code points.
- Integration: draw asserts against the pre-`serialize` buffer (folder-tab chrome + colours); click
  hit-tests drive `select`/`closeTab`/scroll.
