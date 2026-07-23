# Widget Slots: Footer, Aggregation & Master-Detail

> **Document**: 03-03-widget-slots.md
> **Parent**: [Index](00-index.md)

## Overview

The footer's second row: a **flow row of free-form widget slots** — any `View`s the caller supplies
(`footer.widgets: View[]`) — hosting totals `Text`, command `Button`s, and the reactive "N of M"
filtered count + selection count. Buttons dispatch through the event loop via the standard
`command`/`ev.emit` path (AR-3). No new grid API is needed for the read-outs — they are `Text` getters
over accessors that already exist.

## Architecture

### Proposed Changes

The widget row is a flow `Group` (`{ direction: 'row' }`) added inside the footer band container
(03-02), spanning the band width **including the vbar-gutter `corner()`** so `spacer()` right-aligns to
the same right edge as the aggregate row. It is built in `buildGridBody` from `footer.widgets` and hosts
the caller's views in order; a caller inserts `spacer()` (from `@jsvision/ui`) to push trailing widgets
right — the `StatusLine` pattern (a caller-supplied `spacer()` child absorbed by a `{ direction: 'row' }`
layout; `StatusLine` sets that row layout at `statusline.ts:83` but does **not** insert the `spacer()`
itself — the caller does). Height is fixed to **exactly 1 cell** in v1 (`widgetRows = 1`); multi-row is
a caller concern via nested groups.

### Dispatch (AR-3)

- A footer `Button({ command: 'export' })` calls `ev.emit?.('export')` on activation
  (`button.ts:229`); the event loop populates `ev.emit` → `registry.emit` → a `CommandEvent` enqueued
  on the dispatch tick (`event-loop.ts:509`, `commands.ts:59`). The app handles it via
  `loop.onCommand('export', …)`. A `Button({ onClick })` callback also works (the datagrid already
  uses `onClick` for `ValueList`/`FilterPopup`). **The footer only ever emits the command the caller
  wired** (RD Security).
- Footer `Button`s are focusable (`button.ts:52`) and therefore reachable by Tab traversal — desired
  for action buttons. The aggregate `FooterBand` (03-02) stays non-focusable.

### The reactive read-out widgets (RD AC#6)

No new grid API. The caller composes them from existing reactive accessors + the `Text` getter
primitive (`text.ts:120`, a `() => string` repaints on dependency change):

```ts
import { Text, Button, spacer } from '@jsvision/ui';

footer: {
  widgets: [
    new Text(() => `${grid.filteredCount()} of ${grid.totalCount()}`),  // "N of M" — RD-06 accessors
    new Text(() => `${grid.selectedKeys().size} selected`),             // selection count — RD-08 accessor
    spacer(),                                                            // push the button right
    new Button('Export', { command: 'export' }),
  ],
}
```

`filteredCount()` (`grid.ts:722`), `totalCount()` (`:732`), and `selectedKeys()` (`:1104`) already
exist and are reactive; a `Text` getter over them updates live as rows are filtered/selected.

### Integration Points

- The widget row is part of the mounted view tree (a child of the footer band container in `inner`),
  so `ev.emit` is populated when a footer button activates (no extra wiring).
- If a widget itself opens a popup (e.g. a Phase-B navigator), the datagrid's dispatch-seam forwarding
  (`ev.focusView`/`ev.popupHost`, `grid.ts:915`) would apply — out of scope for v1.

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| Widget text with control bytes / injection | Stripped at `ctx.text` (`draw-context.ts:108`) — automatic | AR-12 |
| A `Button` with no `command` and no `onClick` | Inert (framework behavior) — passive label | — |
| Widget row overflow (too many widgets for the width) | Framework row layout clips; caller sizes/`spacer()`s | AR-3 |

> **Traceability:** [00-ambiguity-register.md](00-ambiguity-register.md) AR-3 (layout + dispatch),
> AR-12 (sanitize). RD-06/RD-08 accessors reused (not re-implemented).

## Testing Requirements

- Spec: a footer `Button({ command })` emits its command through the loop on activation (ST-13); the
  N-of-M / selection `Text` read-outs update reactively as filter/selection change (ST-26).
- Impl: widget row present only when `footer.widgets` set; `spacer()` right-alignment; sanitize path.
