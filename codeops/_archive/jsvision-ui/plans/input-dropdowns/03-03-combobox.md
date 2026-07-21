# ComboBox: Input Dropdowns

> **Document**: 03-03-combobox.md
> **Parent**: [Index](00-index.md)

## Overview

`ComboBox<T>` is a control with **no TV counterpart** (the fork lacks it — component map §118): an
`Input` composed with a drop-down `ListView<T>` in the shared anchored popup, **editable** (free
text + filter-as-you-type) or **select-only** (picker + type-ahead). It is designed fresh but
**draws like its TV siblings** (`TListBox`/History popup visuals) per the fidelity directive — the
directive governs pixels even for a TV-less control.

## Architecture

### Proposed Changes

One new file `dropdown/combo-box.ts`. `ComboBox` **composes** (owns) an `Input` (RD-06/07) and a
`ListView<T>` (RD-11), a trailing `▐↓▌` button (the History button glyph/roles, PA-11), and opens
the shared popup ([03-02](03-02-anchored-popup.md)). No engine changes; no Input seam needed
(ComboBox owns its Input's signals directly, unlike History which *links* one).

## Implementation Details

### New Types/Interfaces

```ts
/** Options for a ComboBox. Generic over the item type T. AR-136/AR-164 (two signals). */
export interface ComboBoxOptions<T> {
  /** The candidate items. */
  items: Signal<T[]>;
  /** Render an item to its display/field string. */
  getText: (item: T) => string;
  /** The current selection (null while editable free text matches no item). PA-14. */
  value: Signal<T | null>;
  /** The composed Input's field text (editable mode). Auto-owned if omitted. PA-14. */
  text?: Signal<string>;
  /** Editable (free text + filter) vs. select-only (picker + type-ahead). Default true. AR-131. */
  editable?: boolean;
  /** Filter predicate for editable mode (default: case-insensitive substring). PA-13. */
  filter?: (item: T, text: string) => boolean;
  /** Should-Have: emit on pick (reuses the RD-11 ListView seam). */
  onSelect?: (index: number, item: T) => void;
  command?: string;
  /** Max visible popup rows (default 6). PA-4. */
  maxRows?: number;
}
```

### Behavior

**Open** — the AR-135 keys (Alt+Down / Down) or a mouse-down on the trailing `▐↓▌` button, into the
same clamped popup geometry as `History` ([03-02](03-02-anchored-popup.md)).

**Editable mode (default, AR-131/134/164):**
- The `Input` accepts free text into `text`.
- The dropdown's `items` are narrowed to those matching `text` via `filter` (default
  case-insensitive substring, PA-13) — a `computed` derived from `items` + `text`.
- Picking a row (Enter/double-click) sets `value` = the item **and** `text` = `getText(item)`.
- Free text matching **no** item leaves `value` `null` (PA-14).

**Select-only mode (`editable:false`, AR-131/134):**
- The field is read-only, showing `getText(value)` (or empty when `value` is `null`).
- Typing does **not** edit `text`; it drives the `ListView`'s **type-ahead** position-jump
  (RD-11 `typeAhead`, AR-104) to the first matching row.
- Picking sets `value`.

**Order** — the dropdown lists items in `items`-signal order (app-controlled; ComboBox has no TV
order to be faithful to, unlike History's oldest-at-top, PA-6).

### Integration Points

- Composes an `Input` (owns its `value`/`text` signals — no public seam needed) and a `ListView<T>`
  (reusing `items`/`getText`/`focused`/`selected`/`sorted`/`typeAhead`/`onSelect`/`command`).
- The editable filter is a `computed(() => items().filter((it) => filter(it, text())))` feeding the
  hosted `ListView`'s `items`.
- Reuses `input*`/`list*` theme roles + the History button roles (PA-11); no new core role.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Editable free text matches no item | `value` = `null`; dropdown may show empty filtered list | PA-14 |
| Pick index out of the (filtered) range | Guarded by the `ListView` bounded window; no throw | RD-11, security |
| `items` updates while the popup is open | The filtered `computed` re-renders the visible rows reactively | AC-7 |
| Select-only with `value` set to a non-member `T` | Field shows `getText(value)`; no auto-clear (caller owns `value`) | AR-136 |
| Type-ahead with no match (select-only) | `focused` unchanged (RD-11 typeAhead semantics) | AR-104 |

## Testing Requirements

- Editable: free text into `text`; filter narrows; pick sets `value` + `text`; non-match → `null`.
- Select-only: read-only `getText(value)`; type-ahead jumps `focused`; pick sets `value`.
- Binding: `getText(item)` rows; `items` update re-renders; `value` reflects selection independent
  of `text`. (ST-cases in [07-testing-strategy.md](07-testing-strategy.md).)

> **GATE-2 (AFTER):** diff the ComboBox popup + rows against the `TListBox`/History popup visuals
> (frame, single-column rows, focused-row color) — it must draw like its siblings even though TV
> has no ComboBox. Record the diff.
