# TabView Container: Tabs (RD-17)

> **Document**: 03-01-tab-view.md
> **Parent**: [Index](00-index.md)

## Overview

`TabView` is the public container — a `Group` (AR-169 idiom) owning the focusable tab strip
(`tab-strip.ts`, spec [03-02](03-02-tab-strip.md)) and the bordered content region. It holds the data
model (`tabs`/`active` signals + callbacks), the navigation/cycle/clamp logic, and the
`visible`-binding one-page-at-a-time visibility (a reactive flip, not `Show` — PF-001). It is **self-contained** (AR-174): dropping a `TabView` into any
`Group`/`Window`/`Dialog` is complete — it draws both the strip and the surrounding frame.

## Architecture

### Current Architecture
No tab container exists. The nearest shipped shape is `ListView<T> extends Group` composing
`ListRows<T> extends View` + an owned `ScrollBar` (`list/list-view.ts:43`).

### Proposed Changes
New `src/tabs/tab-view.ts`:
- `TabView extends Group` — constructs the `TabStrip` (focus target) + the content region, wires the
  reactive `Show` page switch, owns nav/clamp, exposes the Should-Have methods.
- The `Tab` descriptor type + `TabViewOptions` ctor options.
- Pure clamp/cycle helpers (`nextEnabled`/`prevEnabled`/`clampActive`/`firstEnabled`) — view-free, unit
  testable, kept in this file (small) so `tab-view.ts` stays ≤500 (else split to `tab-nav.ts`).

## Implementation Details

### New Types/Interfaces

```ts
/** A single tab descriptor. `title` carries optional `~X~` hotkey markup. (AR-178) */
export interface Tab {
  /** Tab label; `~X~` marks the Alt-hotkey letter. Sanitized to screen on draw. */
  readonly title: string;
  /** The page shown when this tab is active — an eager-built Group (AR-175). */
  readonly content: Group;
  /** When true, drawn greyed, unactivatable, skipped by all cycling (AR-176). */
  readonly disabled?: boolean;
  /** When true, the label draws a `×`; clicking it removes the tab + fires onClose (AR-176/178). */
  readonly closeable?: boolean;
}

/** Constructor options for {@link TabView}. */
export interface TabViewOptions {
  /** Caller-owned reactive tab list (AR-178). */
  readonly tabs: Signal<Tab[]>;
  /** Two-way active-index binding; clamped to the tab count (AR-177). */
  readonly active: Signal<number>;
  /** Fired after a tab is removed via its `×` (or programmatically) (AR-178). */
  readonly onClose?: (tab: Tab, index: number) => void;
  /** Fired when the active index changes (Should-Have, PA-1). */
  readonly onChange?: (index: number) => void;
}
```

### New Functions/Methods

```ts
export class TabView extends Group {
  constructor(opts: TabViewOptions);

  /** Set active to `i`, clamped to range; a disabled target is skipped forward to the next
   *  enabled tab (or left unchanged if none) (Should-Have select, PA-1; AR-177). */
  select(i: number): void;
  /** Advance active to the next enabled tab (wrap). Reused by Ctrl+PageDown / `→` / next-cycle. */
  next(): void;
  /** Retreat active to the previous enabled tab (wrap). Reused by Ctrl+PageUp / `←` / prev-cycle. */
  prev(): void;
}

// View-free helpers (unit-testable; AR-176/177):
/** Clamp `i` into `[0, len-1]`; returns 0 for an empty list. */
function clampActive(i: number, len: number): number;
/** Index of the first enabled tab, or -1 if none / empty (snap-to-first-enabled, PA-1). */
function firstEnabled(tabs: Tab[]): number;
/** Next enabled index after `from` with wrap; returns `from` if it is the only/last enabled,
 *  and -1 if no tab is enabled (all-disabled no-op, AR-176 / AC-15). */
function nextEnabled(tabs: Tab[], from: number): number;
/** Previous enabled index before `from` with wrap; symmetric to nextEnabled. */
function prevEnabled(tabs: Tab[], from: number): number;
/** Neighbour index after removing `removed`: prev if it was last, else the same position (AR-177). */
function neighbourAfterRemove(removedIndex: number, newLen: number): number;
/** True if `leaf` is `root` or a descendant of `root` (walks `.parent`); the PF-002 focus-scoping
 *  predicate that gates the global chord + Alt-hotkey to the focus-owning TabView. */
function isWithin(leaf: View | null, root: View): boolean;
```

**Behavioral contracts (each an ST-case source):**

- **Construction / snap (PA-1):** if the constructed `active` points at a disabled tab, snap to
  `firstEnabled(tabs)` (or leave `active` untouched and show no page if all disabled). *(→ ST for AC-15)*
- **One page visible (AR-175):** the content region hosts every `Tab.content` as an eager child (all
  mounted up-front); a reactive `effect` sets each page's `state.visible = (i === active())`, so exactly
  one page is visible and `reflow` omits the hidden pages (`view/reflow.ts:68-70`). Switching is a
  **visibility flip — no mount/dispose**, so page state (input text, scroll, focus) is preserved.
  **Not** `Show` — `Show` disposes the inactive branch on each flip (`reactive/show.ts:33-37`), which
  would tear down page state; a `visible` binding keeps all pages alive. *(→ AC-1 / ST-1/ST-2)*
- **Active binding + clamp (AR-177):** `active` is **caller-owned**, so clamping is **read/render-time**,
  not write-time — a self-correcting `effect` re-clamps `active` into `[0, len-1]` and snaps forward off a
  disabled tab whenever `active` **or** `tabs` changes, **from any writer** (including a raw caller
  `active.set(...)` that bypasses `select()`); every strip/content read also bounds-checks. On a `tabs`
  remove, `active ← neighbourAfterRemove(...)` then re-clamp + snap-if-disabled. Fires `onChange(active())`
  when the value changes. *(→ AC-10 / AC-14 / ST-34)*
- **Navigation (AR-179/183):** the `TabView`/strip `onEvent` consumes —
  - `{pageup, ctrl}` → `prev()`, `{pagedown, ctrl}` → `next()` — **global from anywhere inside _this_
    `TabView`**, handled in `TabView.preProcess`. **Scoping (PF-002):** `preProcess` fires on _every_
    tab view in the dispatch scope (`event/dispatch.ts:154-158`), so the handler consumes the chord
    **only when `ev.getFocused()` is `this` or a descendant of `this`** (`isWithin`, above); otherwise it
    leaves the event for the focus-owning `TabView`. This is what targets the correct panel when two or
    nested `TabView`s coexist. *(→ AC-4 / ST-4 / ST-37)*
  - `{left}`/`{right}` → `prev()`/`next()` **only when the strip holds focus** (in `TabStrip.onEvent`). *(→ AC-5)*
  - `{alt, <letter>}` → jump to the `~X~`-matching enabled tab — same `preProcess` path and the **same
    focus-within-subtree scoping (PF-002, `isWithin`)**, so an Alt-hotkey collision resolves to the
    focus-owning `TabView`. *(→ AC-8 / ST-38)*
  - Ctrl+Tab/Ctrl+Shift+Tab → `next()`/`prev()` **guarded** behind the keyboard-protocol capability
    (registered but inert on the default terminal). *(→ AC-4)*
  - Plain Tab/Shift+Tab are **not** consumed → fall through to RD-04 content-focus traversal. *(→ AC-5)*
- **Close (AR-176/178):** the strip's `×` hit calls a `TabView.closeTab(i)` that mutates the caller's
  `tabs` signal (removes entry `i`), fires `onClose(tab, i)`, and re-clamps `active`. *(→ AC-6/10)*

### Integration Points

- **`Group` (RD-03/01):** `TabView` adds the strip + **all** page children up-front; each page's
  `state.visible` is bound to `active` by a reactive `effect` (**not** `Show` — it would dispose the
  inactive pages, `show.ts:33-37`). Dynamic page add/remove follows the caller's `tabs` signal.
  (`group.ts`, `view/reflow.ts:68-70`).
- **Layout (RD-02):** the content region is the frame interior; strip height = 1 label row + the frame
  edges. Laid out by the normal RD-02 pass — no custom measurement primitive.
- **Focus/keymap/mouse (RD-04):** `TabStrip` is a focusable `View` in the focus chain; nav chords are
  consumed before Tab traversal (`dispatch.ts:114-128`); clicks arrive as `ev.local` hit-tests.
- **Theme (core):** labels draw in `tabActive`/`tabInactive`/`tabDisabled` (spec
  [03-03](03-03-theme-packaging.md)); the frame border draws in the existing frame role.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `active` out of range (any source) | `clampActive` on every write; empty list → no page shown | AR-177 / AC-15 |
| Remove leaves `active` dangling | `neighbourAfterRemove` → clamp → snap-if-disabled | AR-177 / AC-10 |
| All tabs disabled | cycling helpers return -1 → no page shown, cycle is a no-op (no infinite loop) | AR-176 / AC-15 |
| Empty `tabs` signal | strip draws no labels; content region draws empty; no indexing | AC-15 |
| Alt-hotkey to a disabled tab | skipped (jump only to enabled matches) | AR-176 / AC-8 |
| Malicious/long/escape-laden title | drawn via `DrawContext`+`sanitize`, width-clipped by the strip | security / AC-14 |

> **Traceability:** Every strategy references the AR entry that resolved it. See
> `00-ambiguity-register.md` (plan) + imported AR-172…185.

## Testing Requirements
- Unit tests for the view-free helpers (`clampActive`/`firstEnabled`/`nextEnabled`/`prevEnabled`/
  `neighbourAfterRemove`) — happy path, wrap, all-disabled (-1), empty — and the `isWithin`
  focus-scoping predicate (self, descendant, foreign, `null` leaf).
- Integration: `visible`-binding page switch on `active` change (both pages stay mounted; state
  preserved); `onChange`/`onClose` firing; read-time clamp on a raw caller `active.set`; clamp on
  remove; **two-`TabView` scoping** — a global chord / Alt-hotkey acts only on the focus-owning view
  (ST-37/ST-38).
