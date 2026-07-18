# Column Validation & Commit Pipeline

> **Document**: 03-01-column-validation-and-commit-pipeline.md
> **Parent**: [Index](00-index.md)

## Overview

The per-cell half of the commit-safety layer: a typed column `validate` gate that runs on the parsed
value before the write, and a `beforeSave` veto that layers above `onCommit` after the write. This
document owns the `validate` field, the `commitCell` extension, and the exact `commitValue` ordering
(AR-8/AR-9/AR-14).

## Architecture

### Current

`commitValue()` (`editing.ts:291-326`) parses, rejects `PARSE_FAILED`, then hands the write+veto to
`commitCell()` (`commit.ts:58-81`, `apply → onCommit → revert-on-veto`). There is no value-level
validation and no gate between `apply` and `onCommit`.

### Proposed

Two additive gates, in the RD's order (AR-8):

```
raw = field()
value = nullable-empty ? null : parse(raw)
── PRE-APPLY (blocking; nothing written, editor stays open) ──
if value === PARSE_FAILED     → invalid(cell, parseMessage)      ; return false
msg = value === null ? null : column.validate?(value, row)      // a nullable clear is NOT a typed value → skip validate
if msg != null                → invalid(cell, msg)              ; return false
── APPLY + POST-APPLY VETO (optimistic write, revert on veto) ──
commitCell(apply, beforeSave, onCommit):
    apply(row, col, value)                    // immediate write
    if beforeSave && !(await beforeSave(change)) → apply(previous) ; return vetoed
    if onCommit   && !(await onCommit(change))   → apply(previous) ; return vetoed
    return committed
on committed → clearInvalid(cell); close editor
```

`validate` is **pre-apply** — an invalid value never reaches the record. `beforeSave`/`onCommit` are
**post-apply** vetoes that revert. This resolves the RD's per-cell-immediate timing nuance (RD-12
Feature Overview; AR-8).

## Implementation Details

### New types / fields

**`GridColumn.validate` (`column.ts`, AR-1):**

```ts
/**
 * Validate the parsed value at commit time (editable columns). Return `null` to accept, or a short
 * message describing why the value is invalid. On a message the commit is blocked, the editor stays
 * open, and the cell is marked in the `gridInvalid` role with the message surfaced. Runs on the typed
 * value AFTER `parse`, so it composes with the editor's live keystroke filter (which is unaffected).
 * Not called when a `nullable` column is cleared to `null` (an empty clear is not a typed value to
 * validate), so a validator written for the typed `V` never receives `null`. Client-side validation is
 * UX only — the authoritative gate is the caller's `onCommit`/source.
 */
readonly validate?: (value: V, row: T) => string | null;
```

Erased to `(value: unknown, row: T) => string | null` on the `GridColumn<T>` collection type, exactly
as `parse`/`format` are erased (`column.ts:176-181`) — the caller-facing `column()` keeps `V` typed.

**`beforeSave` on the commit primitive (`commit.ts`, AR-9):** extend `commitCell`'s args with an
optional gate; add nothing to `CellCommit`/`OnCommit` (the payload is unchanged).

```ts
export type BeforeSave<T> = (change: CellCommit<T>) => boolean | Promise<boolean>;

// commitCell(args) gains:
//   beforeSave?: BeforeSave<T>;
// Ordering inside commitCell: apply(next) → [beforeSave veto? revert+return] → [onCommit veto? revert+return] → commit.
```

`beforeSave` and `onCommit` share the one revert path already in `commitCell` (`commit.ts:79`); a
reject or `false` from either reverts to `previous` and returns `{ committed: false }`. A `beforeSave`
veto means `onCommit` is **not** awaited (RD AC-3).

### New / changed functions

**`commitCell` (`commit.ts`)** — after `apply(row, columnId, next)`:

```ts
const gate = async (fn?: (c: CellCommit<T>) => boolean | Promise<boolean>): Promise<boolean> => {
  if (!fn) return true;
  try { return await fn({ rowKey, columnId, value: next, previous, row }); }
  catch { return false; }            // a rejected gate is a veto, not a crash (matches the current onCommit)
};
if (!(await gate(beforeSave)) || !(await gate(onCommit))) {
  apply(row, columnId, previous);    // single revert path
  return { committed: false, value: previous };
}
return { committed: true, value: next };
```

**`commitValue` (`editing.ts`)** — insert the pre-apply `validate` check beside the existing
`PARSE_FAILED` check, and thread `beforeSave` + the error registry through the `EditHost`:

- The `EditHost<T>` (`editing.ts:120-139`) gains `beforeSave?: BeforeSave<T>` and
  `errors?: ErrorRegistry` (the invalid-cell registry, owned by the container; see
  [03-02](03-02-error-surfacing.md)).
- On a blocking result (`PARSE_FAILED` or a `validate` message), call `host.errors?.set(ck, message)`
  and `return false` (editor stays open; nothing applied). `PARSE_FAILED` uses a generic message —
  `column.validate?.(…)` is not consulted because there is no parsed value; the message is
  `'Invalid value'` unless the column supplies one via a future hook (AR-14 keeps it a constant for
  v1).
- On a successful `commitCell`, call `host.errors?.clear(ck)` (the cell is now valid) alongside the
  existing `dirty.delete(ck)`.
- **On `cancel()` (Escape), call `host.errors?.clear(ck)` for the edited cell before closing.** A
  blocking `validate`/`PARSE_FAILED` marks the cell but writes nothing, so the record keeps its prior
  **valid** value; if the user then presses Escape (a normal way to abandon a bad edit), the marker
  must clear — otherwise a valid-valued cell would keep a stale `gridInvalid` marker with no passive
  recovery (`beginEdit`/`cancel` touch no registry today, `editing.ts:188-258`/`:279-283`). This is
  the Escape half of RD-12's "clearing the error clears the marker".
- `beforeSave` is passed into `commitCell` from `host.beforeSave`.

The two entry paths (`commit`/`commitEdit`, `editing.ts:328-341`) are unchanged — they call
`commitValue` and branch on its boolean exactly as today.

### Integration points

- `grid.ts` threads `opts.beforeSave` and the container's error registry into `_bodyDeps` →
  `EditableGridRowsConfig` → `EditHost` (mirroring how `onCommit`/`dirty` are threaded today,
  `grid.ts:486-488`).
- The column `validate` needs no wiring beyond being read in `commitValue` — it travels on the column.

## Code Examples

```ts
const price = column({
  id: 'price', title: 'Price', value: (r: Item) => r.price,
  parse: (t) => Number(t), set: (r, v) => { r.price = v; },
  editor: { kind: 'decimal' },                         // keystroke filter (RD-03) — unchanged
  validate: (v) => (v >= 0 ? null : 'Price cannot be negative'), // pre-apply commit gate
});

// Grid-level beforeSave (per-cell, above onCommit):
new EditableDataGrid<Item>({
  columns, source,
  beforeSave: (c) => hasWritePermission(c.columnId),   // veto → revert + surface, onCommit skipped
  onCommit: (c) => persist(c),
});
```

## Error Handling

| Error case | Handling strategy | AR |
| ---------- | ----------------- | -- |
| `parse` returns `PARSE_FAILED` | Mark invalid + generic message; editor open; nothing written (existing behavior preserved) | AR-14 |
| `validate` returns a message | Mark invalid + that message; editor open; nothing written | AR-1, AR-8 |
| Nullable column cleared to `null` | `validate` is **not** called (the null clear commits normally, subject only to `beforeSave`/`onCommit`); the caller's typed validator never sees `null` | AR-1 |
| `beforeSave` returns `false`/rejects | Revert to `previous`; surface a veto message; `onCommit` not called | AR-3, AR-9 |
| `onCommit` returns `false`/rejects | Revert to `previous`; surface a veto message (existing behavior) | AR-9 |
| **Escape after an invalid mark** | `cancel()` clears the cell's error entry (`errors.clear(ck)`) before closing; no stale marker on a valid-valued cell | AR-1, AR-10 |
| Overlapping commit on the same cell | The existing per-cell `committing` guard (`editing.ts:295`) serializes; unchanged | RD-02 |

## Testing Requirements

- Spec: `validate` message blocks the commit + marks the cell + keeps the editor open; a `null`
  validate commits; `beforeSave` veto reverts + skips `onCommit`; the full ordering
  (parse→validate→apply→beforeSave→onCommit) reverts at each post-apply gate (ST-1…ST-6,
  [07](07-testing-strategy.md)).
- Impl: `commitCell` beforeSave/onCommit interaction (both present, beforeSave short-circuits);
  a rejecting `beforeSave` treated as veto not crash; `validate` erased-type soundness; a nullable
  clear (empty → `null`) commits without calling `validate`; Escape after a blocking `validate`/parse
  clears the cell's error entry; the `editing.spec`/`parse-commit.spec` oracles stay green (regression).
