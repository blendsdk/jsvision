# Current State: the code the Tree builds on

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

RD-15 adds `packages/ui/src/tree/` on top of the RD-11 container tier and the RD-01/02/03 spine —
**reusing existing primitives with no new engine machinery and no changes to existing code** (the
sole cross-package edit is the additive core theme roles). Every claim below is grounded in the real
source (`file:line`), verified during planning recon.

## Reuse surfaces (verified)

### Virtual-scroll helpers — `packages/ui/src/list/virtual.ts`
- **`clampIndex(index, range) → number`** (`virtual.ts:12-15`) — clamps an item index into
  `[0, range-1]`; `range ≤ 0 → 0` (TV `focusItemNum`). The Tree clamps `focused` to the flattened
  count after every expand/collapse (PA-15).
- **`keepVisible(focused, topItem, viewportRows, range) → number`** (`virtual.ts:29-37`) — returns
  the `topItem` that keeps `focused` in view (scroll up if `focused < top`, down if
  `focused ≥ top + rows`), clamped to `[0, max(0, range-rows)]`. The Tree's renderer uses it exactly
  as `ListRows` does.

### Owned `ScrollBar` — `packages/ui/src/scroll/scroll-bar.ts`
- **`ScrollBarOptions`** (`scroll-bar.ts:65-79`) — `{ value: Signal<number>, min?, max?, pageStep?,
  arrowStep?, orientation? }`. `ScrollBar` is `focusable = false` passive chrome (`:83`); the owning
  viewer drives keys.
- **`setRange(min, max, pageStep?)`** (`scroll-bar.ts:127-131`) — the owner re-limits the bar when
  the content extent changes (TV `setLimit`). The Tree calls
  `bar.setRange(0, max(0, flatCount-1), max(1, rows-1))` in `draw()`, exactly as `ListRows` does
  (`list-rows.ts:177`).
- Wheel = `3·arrowStep`, thumb-drag via the `ev.setCapture?.(this)` seam (`scroll-bar.ts:207-269`) —
  reused unchanged.

### The owned-bar composition pattern — `packages/ui/src/list/list-view.ts`
- `ListView<T> extends Group` with `layout = { direction: 'row' }` (`list-view.ts:44`), children =
  `rows` (`size: fr`) + `bar` (`size: fixed 1`), constructed and wired at `:75-77`:
  ```ts
  this.bar = new ScrollBar({ value: this.focused, orientation: 'vertical' });
  this.bar.layout = { size: { kind: 'fixed', cells: 1 } };
  this.rows.bar = this.bar;   // the rows renderer re-limits the bar each draw
  ```
  The `focused` signal is shared between `rows` (focus source) and `bar.value` (position). **`Tree`
  mirrors this exactly** — `[TreeRows fr | ScrollBar 1]`, `focused` shared.

### The row-renderer sibling — `packages/ui/src/list/list-rows.ts` (336 lines)
`ListRows<T> extends View` (`list-rows.ts:78-116`) is the structural template for `TreeRows<T>`:
- `focusable = true`; holds `getText`, `focused`/`selected` signals, `roles`, `topItem`, `bar?`.
- `draw(ctx)` (`:171-214`) — sets the bar range (`:177`), renders the visible window, resolves the
  row role **focused > selected > normal** (`:201-208`), draws text at column 1 (`:212`).
- `onEvent`/`handleKey` (`:221-286`) — wheel ±3, mouse-down → `newItem = mouse.y + topItem`, ↑↓/
  PgUp/PgDn/Home/End/Enter/Space; type-ahead (`:314-335`).
> **Divergence for `TreeRows` (why AR-145 needs its own renderer):** `ListRows` draws one role per
> row at col 1 and ignores ←→. `TreeRows` adds: the **graph prefix** before the text, the **two-tone
> collapsed colour** (`outlineNotExpanded` for a collapsed node's text), the **graph-click expand
> zone** (`mouse.x < graphWidth`), and **←/→ = collapse/expand** — none expressible through
> `ListRows`. TV made `TOutlineViewer` its own `TScroller` subclass for exactly this reason. At ≈450
> lines the renderer gets its own file (PA-7); the flatten/graph helpers live in `graph.ts`.

### Base spine — `packages/ui/src/view/`
- `View` (`view/view.ts`): `bounds` (`:44`), `state` flags (`:47`), `focusable` (`:66`),
  `castsShadow` (`:58`), `abstract draw(ctx)` (`:113`), `onEvent(ev)` (`:122`), `invalidate()`
  (`:140`), `bind(reader, apply?, {relayout?})` (`:162-174`), `focusSignal()` (`:88-90`),
  `onMount`/`onCleanup`. The Tree binds `roots` + the expand-version signal + `focused` via `bind`,
  re-flattening and repainting on change.
- `DrawContext` (`view/types.ts:39-57`): `text(x,y,str,style)` (clips + `sanitize`), `fillRect`,
  `fill`, `color(role): Style`, `role(name): Theme[role]`, `size`. `TreeRows.draw` uses `text` for
  the graph prefix + node text and `color(role)` per row state / two-tone.

## Additive theme-role pattern — `packages/core/src/engine/color/theme.ts`
- `ThemeRole` (`theme.ts:17-22`) = `{ fg: Color, bg: Color, hotkey?: Color }`.
- RD-14 added 5 `history*` roles to the `Theme` interface (`:147-180`) + `defaultTheme` (`:263-267`)
  as the template. **RD-15 adds exactly 4 flat `ThemeRole`s** (`outlineNormal`/`outlineFocused`/
  `outlineSelected`/`outlineNotExpanded`) — same additive, non-breaking pattern (AC-9/PA-8); no
  role-only extras needed (unlike `historyWindow`'s `border`/`icon`).
- `ThemeRoleName = keyof Theme` (`view/types.ts`), so the new roles are usable via
  `ctx.color('outlineFocused')` with no other change. **No `ListRows.roles`-style override is needed**
  — `TreeRows` reads the outline roles directly (it is a bespoke renderer, not a `ListRows`).

## Barrel / re-export convention — `packages/ui/src/index.ts`
Explicit named re-exports (not `export *`), one comment block per subsystem (RD-11 block at
`index.ts:85-93`). RD-15 adds a `tree/` block:
```ts
// Tree/outline (RD-15) — expandable virtual-scroll outline. Explicit named re-exports.
export { Tree } from './tree/index.js';
export type { TreeNode, TreeOptions } from './tree/index.js';
```
The subsystem barrel `tree/index.ts` re-exports from `tree.ts` (+ `TreeRows`/`graph` stay internal
unless a test needs them).

## What is NOT changing
- No new engine primitives; no `EventLoop`/`View`/`Group` seam (unlike RD-14's popup-host seam).
- No changes to `list/`, `scroll/`, `dialog/`, `menu/`, `event/` — the Tree only *reads* their
  public helpers.
- The only cross-package edit is the 4 additive `defaultTheme` roles.
