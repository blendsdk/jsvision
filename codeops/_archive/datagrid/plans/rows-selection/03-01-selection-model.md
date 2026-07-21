# Selection Model (`selection.ts`, pure): Rows, Records & Selection

> **Document**: 03-01-selection-model.md
> **Parent**: [Index](00-index.md)

## Overview

The pure, view-free selection ops — the data-plane twin of `sort.ts` / `filter.ts` /
`column-model.ts` (AR-9). No signals, no `View`; just functions over `ReadonlySet<Key>` and a display
key list. The container (`03-02`) wraps these in a `selectedKeys` signal + an `anchorKey` field.

## Architecture

### Proposed Changes

A new `packages/datagrid/src/selection.ts` exporting the `Key` type, a `SelectionMode` type, and the
pure transforms. Each returns a **new** `ReadonlySet<Key>` (never mutates its input) so the container
can `selectedKeys.set(next)` and drive reactive repaint.

## Implementation Details

### New Types

```ts
/** A stable row identity (matches `GridDataSource.rowKey`'s return). */
export type Key = string | number;

/** Single-select replaces on each pick; multi accumulates. */
export type SelectionMode = 'single' | 'multi';

/** Header select-all tri-state over the displayed rows. */
export type TriState = 'none' | 'some' | 'all';
```

### New Functions (pure)

```ts
/**
 * Toggle `key`'s membership. In `multi` mode it is added if absent, removed if present. In `single`
 * mode a present key clears the set; an absent key **replaces** the set with just `{key}`.
 */
export function toggleKey(current: ReadonlySet<Key>, key: Key, mode: SelectionMode): ReadonlySet<Key>;

/**
 * Select the contiguous range between `anchorKey` and `toKey` **in display order** (`displayKeys` is
 * the current `display()` mapped to keys). In `multi` mode the range is unioned onto `current`; in
 * `single` mode the range collapses to `{toKey}` (single can't hold a range). Order-independent:
 * anchor after target selects the same rows. Keys not in `displayKeys` (e.g. a stale anchor) fall
 * back to selecting just `toKey`.
 */
export function selectRange(
  current: ReadonlySet<Key>, anchorKey: Key, toKey: Key, displayKeys: readonly Key[], mode: SelectionMode,
): ReadonlySet<Key>;

/** Every displayed row (the header select-all target, AR-7). */
export function selectAll(displayKeys: readonly Key[]): ReadonlySet<Key>;

/** The header tri-state over the displayed rows: none / some / all selected. */
export function triState(current: ReadonlySet<Key>, displayKeys: readonly Key[]): TriState;
```

`clear` is just `new Set()` at the call site; `single`-mode plain-select is `toggleKey` on an absent
key (replaces). No stateful `SelectionModel` object — the RD-08 interface is realized as container
state driven by these ops (AR-9).

### Integration Points

- **Container (`03-02`)** holds `selectedKeys = signal<ReadonlySet<Key>>(new Set())` + `anchorKey: Key
  | null`, and calls these ops from the gestures.
- **`display()`** (`grid.ts:293`) provides the ordered rows; the container maps them through
  `source.rowKey` to the `displayKeys` list these ops need.

## Code Examples

```ts
import { toggleKey, selectRange, triState } from '@jsvision/datagrid';

let sel = new Set<number>();
sel = toggleKey(sel, 1, 'multi');           // {1}
sel = toggleKey(sel, 2, 'multi');           // {1,2}
sel = selectRange(sel, 1, 4, [1,2,3,4,5], 'multi'); // {1,2,3,4}
triState(sel, [1,2,3,4,5]);                 // 'some'
sel = toggleKey(sel, 9, 'single');          // {9} — single replaces
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `anchorKey` / `toKey` not in `displayKeys` (stale after delete/filter) | Fall back to selecting just `toKey`; the container clears a dangling anchor | AR-10 |
| `single` mode asked for a range | Collapse to `{toKey}` (single can't represent a range) | AR-2 |
| Empty `displayKeys` | `selectAll` → `{}`; `triState` → `'none'` | — |

> **Traceability:** decisions cite `00-ambiguity-register.md` (AR-9/AR-2/AR-10).

## Testing Requirements

- Unit (spec): `toggleKey` add/remove/single-replace; `selectRange` forward + backward + single
  collapse + stale anchor; `selectAll`; `triState` none/some/all (ST-1…ST-7).
- Impl edges: toggle an absent key in single vs multi; range where anchor == target; range spanning
  the whole display; `triState` on an empty selection.
