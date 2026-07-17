# Requirements: Split-Panes Follow-ups

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

This plan has no upstream RD — it follows the parent `split-panes` plan's plans-only precedent. This
document is the owning requirements doc for the three follow-ups.

## Feature Overview

Three additive follow-ups to the shipped `SplitView`:

1. A reactive, optional `▓` grab mark on splitters.
2. A demonstration that scrollable widgets work inside panes.
3. A demonstration that a `SplitView` nests inside a `Window`.

## Functional Requirements

### Item 1 — Reactive grab-mark toggle (shipped code)

- [x] **F1** — `SplitViewOptions` gains an optional `grabMark?: boolean`; when omitted it defaults to
  `true`, so existing callers get byte-identical output (the `▓` still shows). *(AR-2, AR-3, AR-11)*
- [x] **F2** — `SplitView` exposes a public `readonly grabMark: Signal<boolean>` seeded from the
  option. Writing it (`split.grabMark.set(false)`) repaints every splitter on the next frame — the
  grab mark disappears; setting it back restores it. *(AR-3)*
- [x] **F3** — With `grabMark` false, a splitter draws only its line (`│`/`─`) — no `▓` — in both
  `row` and `col` directions and for every divider. With it true, the `▓` sits at the divider's
  midpoint exactly as it does today. *(AR-3)*
- [x] **F4** — The reactive flip works because `Splitter` binds `owner.grabMark()` in `onMount`
  (draw is not auto-tracked — the same reason `dragging` is bound). *(AR-3)*
- [x] **F5** — The `layout/split` kitchen-sink story flips the grab mark live: pressing `g` toggles
  `grabMark` on its splits (a `‹g› grab mark` hint is shown), via a `preProcess` root that leaves the
  splitter's arrows untouched. *(AR-4, AR-12)*
- [x] **F6** — The `SplitView` class `@example` gains a `grabMark` toggle line and the new members
  carry descriptive JSDoc (`check-jsdoc.mjs` requires `@example` on the exported class, not on its
  interface fields / class properties, so the members need description JSDoc only);
  `scripts/check-jsdoc.mjs` stays green; the plugin API reference is regenerated so `check-plugin`
  passes. *(AR-3)*

### Item 2 — Scrolling widget in a pane (demo)

- [x] **F7** — A new kitchen-sink story (`layout/split-scroll`, category `Layout`) renders a `row`
  `SplitView` whose first pane is a `ListBox` of enough items to overflow, beside an info pane; the
  list scrolls within its pane bounds. *(AR-5, AR-6)*
- [x] **F8** — The `ListBox` is a **direct** pane child (no wrapper) and still renders its
  `[rows | bar]` correctly, because the engine defaults `direction` to `'row'`. *(AR-6)*
- [x] **F9** — The story passes the headless smoke test: registered with unique id + required
  metadata, paints headlessly, and paints a list item label (proving the list rendered in the pane).
  *(AR-5, and the repo's non-negotiable showcase gate)*

### Item 3 — Split inside a Window (demo)

- [x] **F10** — The amiga-clock demo gains a 4th `Clocks` `Window` hosting a `position:'fill'`
  `SplitView` — a nested grid `row:[ Analog | col:[ Digital / Boing ] ]` — using **fresh** clock
  instances bound to the same `now`/`frame` signals. *(AR-7)*
- [x] **F11** — The existing three standalone clock windows are kept unchanged; the split window is
  added alongside them. *(AR-7)*
- [x] **F12** — Covered by `yarn typecheck` + a manual run; no automated test is added. *(AR-8)*

## Technical Requirements

### Compatibility

- **Backward compatibility is absolute:** `grabMark` is an optional field on an existing exported
  type; every current `SplitView` call site produces byte-identical output (default `true`). The
  shipped `split.spec.test.ts` oracle is left untouched; new coverage lives in new files. *(AR-11)*
- ESM-only; NodeNext `.js` import specifiers in `.ts` sources.
- Zero runtime dependencies — `yarn check:deps` stays green. `@jsvision/core` is untouched.

### Performance

- No layout hot-path change: `grabMark` gates a single `ctx.text(...)` call in `Splitter.draw`; the
  binding is one extra signal read per splitter (mirroring the existing `dragging` bind). The 16 ms
  frame ceiling (informational) must not regress.

### Documentation

- Every public export carries JSDoc with a working `@example` (`scripts/check-jsdoc.mjs` gates it).
- No CodeOps/RD/plan IDs and no Turbo Vision / C++ provenance in shipped code or comments.

## Scope Decisions

| Decision | Chosen | Rationale | AR Ref |
| -------- | ------ | --------- | ------ |
| grabMark reach | Reactive + live toggle | User choice | AR-2 |
| grabMark API | `boolean` option + public `Signal<boolean>` | Mirrors `dragging`/`sizes`; static default is trivial | AR-3 |
| Live-toggle home | Existing `layout/split` story, key `g` | Keeps the scroll story focused | AR-4 |
| Scroll demo | New story, `ListBox` + info pane, `row` | User choice | AR-5 |
| Scroll pane child | Direct `ListBox`, no wrapper | Default `direction:'row'` preserves `[rows|bar]` | AR-6 |
| Clock split | 4th window, nested grid | User choice | AR-7 |
| Item-3 tests | Typecheck only | Matches amiga-clock's current coverage | AR-8 |

## Won't Have (Out of Scope)

- **A grid-scroll or DataGrid pane demo** — item 2 ships a `ListBox` only. *(AR-5)*
- **Per-splitter grab-mark control** — `grabMark` is a whole-`SplitView` concern. *(AR-3)*
- **A theme role for the grab mark** — no `@jsvision/core` change; it stays in the `splitter` role. 
- **An automated test for the amiga-clock window.** *(AR-8)*

## Acceptance Criteria

1. [x] `grabMark?: boolean` (default `true`) + `SplitView.grabMark: Signal<boolean>` ship; flipping
   the signal shows/hides the `▓` on the next frame, in both directions. *(F1–F4)*
2. [x] Every existing `SplitView` call site is byte-identical; `split.spec.test.ts` untouched and green. *(F1, AR-11)*
3. [x] The `layout/split` story toggles the grab mark on `g` without disturbing arrow-key resize. *(F5)*
4. [x] A new `layout/split-scroll` story shows a `ListBox` scrolling in a pane and passes the smoke test. *(F7–F9)*
5. [x] The amiga-clock demo shows a nested split inside a `Clocks` window; `yarn typecheck` green. *(F10–F12)*
6. [x] `CI=1 yarn verify` green; `yarn check:deps` green; `scripts/check-jsdoc.mjs` green; plugin API reference regenerated. *(F6)*
