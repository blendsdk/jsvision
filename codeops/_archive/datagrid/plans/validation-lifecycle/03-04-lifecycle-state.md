# Lifecycle State

> **Document**: 03-04-lifecycle-state.md
> **Parent**: [Index](00-index.md)

## Overview

The grid's `loading` / `ready` / `empty` / `error` states: a caller-driven `status` input plus an
auto-derived `empty`, rendered by swapping the visible region between the grid body+footer and a
placeholder view. Owns the `GridStatus` type (AR-12), the state views (AR-6/AR-13), and the swap
(AR-2).

## Architecture

### Current

The source is synchronous (`data-source.ts:22-59`); there is no loading/error concept. Empty is a
hardcoded `<empty>` placeholder drawn by the body at zero rows (`editable-grid-rows.ts:674-677`), with
no hook. `Spinner`/`runSpinner` exist in `@jsvision/ui` (`feedback/`) but are unused.

### Proposed

A caller reactive `status` getter drives `loading`/`ready`/`error`; the grid derives `empty` from the
filtered count when `ready`. A lifecycle controller computes the effective state and swaps the body
region for a placeholder view when not showing the grid.

## Implementation Details

### Types (`grid-lifecycle.ts`, AR-2/AR-12)

```ts
export type GridStatus =
  | 'loading' | 'ready'
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string; retry?: () => void };

// grid option:
readonly status?: () => GridStatus;   // reactive — evaluated in the grid's derivation
readonly emptyText?: string;          // AR-6, default 'No rows'
```

The string shorthands `'loading'`/`'ready'` normalize to the object forms. The effective state
(computed reactively, read on demand — no owned `computed`):

```
raw = status?.() ?? 'ready'
if raw is loading            → LOADING
if raw is error              → ERROR(message, retry)
else (ready):
  if filteredCount() === 0   → EMPTY(filterActive ? 'No matching rows' : emptyText)
  else                       → GRID
```

`filterActive` is `filteredCount() < totalCount()` (both already exposed, `grid.ts:714/720`) — the
built-in distinction of AR-6. Precedence: loading/error win over empty; empty only when ready.

> **v1 caveat (inherited):** this distinction is exact on the **client path** (the only path in v1 —
> RD-11 windowing is not built). On a future push-down/windowed source `source.length()` already
> reflects the filtered set, so `filteredCount() === totalCount()` and a filtered-empty grid would show
> `emptyText` rather than "No matching rows" — the same limitation already documented on
> `grid.ts` `totalCount()`. When the windowing seam exposes a separate pre-filter total, the empty
> derivation reads that instead; no contract change here.

### The state views (AR-13/AR-6)

- **LOADING** — a centered `Spinner` (composed with `runSpinner` on a grid-owned `frame` signal
  advanced by the loop timer; a static first frame paints headless, AR-13) with an optional
  `'Loading…'` label.
- **EMPTY** — a centered `Text` with the resolved message (`emptyText` or the filter-aware built-in).
- **ERROR** — a centered `Text(message, { severity: 'error' })` plus, when `retry` is provided, a
  `Button('Retry')` whose `onClick` calls `retry()`. The message is sanitized at draw (AR-19). No
  retry button when `retry` is absent.

All three are built by `grid-lifecycle.ts` factories and sized to the body region.

### The swap (AR-2)

A `LifecycleController` owned by the container:

```ts
export interface LifecycleController {
  /** The effective state (reactive read). */
  state(): 'loading' | 'ready' | 'empty' | 'error';
  /** The view to show for the current state (the grid body region, or a placeholder). */
  // Wired as a reactive swap in grid-panels assembly.
}
```

The container holds a single **swap host** `Group` in the body region. An effect (bound in the
grid's scope) sets the swap host's child to either the assembled grid body+footer (the existing
`buildGridBody` output) or the placeholder for the current state. The header stays visible in all
states (so a loading/empty/error grid still shows its columns); only the **body region** swaps. The
footer band + message band belong to the grid view and show only in the `GRID`/`EMPTY` states (a
loading/error grid hides them).

The body's own hardcoded `<empty>` (`editable-grid-rows.ts:674-677`) is superseded when the container
owns the empty state; it remains as the fallback when no `status`/`emptyText`/lifecycle is configured
(so a plain grid with zero rows still shows something) — i.e. the container swap engages only when
lifecycle is in play, keeping the no-config path byte-identical (zero RD-01…11 regression).

## Integration Points

- `grid.ts` gains `status?`/`emptyText?` options, constructs the `LifecycleController`, and hands the
  swap host + placeholders to `grid-panels.ts` (a new body-dep) — thin wiring; the view logic lives in
  `grid-lifecycle.ts`.
- `retry()` is the caller's callback; the grid only invokes it (the caller re-loads and flips
  `status` back to `ready`). The grid does not retry on its own.
- Reads `filteredCount()`/`totalCount()` (`grid.ts:714/720`) for the empty derivation.

## Error Handling

| Case | Handling | AR |
| ---- | -------- | -- |
| `status` undefined | Effective state = `ready` (or `empty` at zero rows); no loading/error ever | AR-2 |
| `error` with no `retry` | Error view without a retry button | AR-12 |
| Zero rows due to a filter | `'No matching rows'` (not `emptyText`) | AR-6 |
| Zero rows, no filter | `emptyText` (default `'No rows'`) | AR-6 |
| `status()` throws | Treat as `ready` (defensive; never crash the render) | AR-12 |
| Loading with no running clock (tests) | Static first spinner frame paints | AR-13 |

## Testing Requirements

- Spec: `status` `'loading'` → spinner region; `error` → message + working `retry()` (invoking it
  calls the callback); `ready` + 0 filtered rows → empty view; the filter-aware message distinction;
  `ready` + rows → the grid (ST-16…ST-19, [07](07-testing-strategy.md)).
- Impl: string-shorthand normalization; header stays visible across states; the no-config zero-row
  path still shows the body `<empty>` (regression); `status()` throw handled; retry button absent
  without `retry`.
