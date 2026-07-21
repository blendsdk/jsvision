# Variant Store: Personalization Dialog

> **Document**: 03-02-variant-store.md
> **Parent**: [Index](00-index.md)

## Overview

The caller-provided persistence seam the dialog reads and writes variants through (RD-16 §Technical,
AR-47). The grid holds **no** variant registry; the app passes a `VariantStore`, and a reference in-memory
implementation ships for the showcase/tests. Owns RD-16 AC#9 (the store side) and PF-026.

## Architecture

### Current Architecture
None — there is no store abstraction today. RD-13 deliberately kept the grid stateless about persistence
([RD-13 AR #10]); this plan adds the seam without adding grid state.

### Proposed Changes
New module `packages/datagrid/src/variant-store.ts`: the `VariantStore` interface + `createMemoryVariantStore()`.

## Implementation Details

### New Types/Interfaces

```ts
import type { GridVariant } from './variant.js';

/** The app-provided store the dialog reads and writes variants through. The grid holds no registry. */
export interface VariantStore {
  /** All saved variants, newest-or-app-ordered. A synchronous snapshot the dialog renders. */
  list(): readonly GridVariant[];
  /** Insert or overwrite by `variant.name`. */
  save(variant: GridVariant): void;
  /** Remove the variant with this name (no-op if absent). If it was the default, the default is cleared. */
  delete(name: string): void;
  /** Mark the named variant the default (persisted by the store). */
  setDefault(name: string): void;
  /** The default variant's name, or `undefined` when none is set. */
  getDefault(): string | undefined;
}
```

### New Functions

```ts
/** A reference in-memory VariantStore (an array + a default name). Real persistence is the app's job. */
export function createMemoryVariantStore(initial?: readonly GridVariant[]): VariantStore;
```

### Semantics (the reference implementation)

- **Synchronous contract** — `list()`/`getDefault()` return the current in-memory snapshot. `save`/`delete`/`setDefault` return `void`; the dialog re-reads `list()` after each mutation. An app backing the store with a file/DB hydrates it before opening the dialog.
- **`save(variant)`** — insert or overwrite by `variant.name` (an existing name replaces in place; order preserved for a replace, appended for a new name). The dialog owns the *confirm-overwrite* UX ([03-03](03-03-personalize-dialog.md)); the store itself always overwrites.
- **`delete(name)`** — remove by name (no-op if absent). **If `name` is the current default, clear the default** (`getDefault()` returns `undefined` afterward) — PF-026.
- **`setDefault(name)`** — record the default name. (The reference impl does not validate that `name` exists — a store may legitimately set a default it is about to `save`.)
- **`createMemoryVariantStore(initial?)`** — seeds the array from `initial` (defensive-copied); no default set initially.
- **Immutability** — `list()` returns a defensive copy (or a `readonly` view) so a caller cannot mutate the store's array in place.

### Integration Points
- The dialog calls only these five methods; it never reaches grid state for persistence.
- `GridVariant` is the sole payload type (already barrel-exported, `index.ts:57`).
- Used by the showcase demo (seeded with a couple of variants) and by the spec/impl tests as the real
  object (no mocking — prefer real objects).

## Code Examples

### Example 1: app-owned store, seeded and defaulted
```ts
const store = createMemoryVariantStore([compactVariant, wideVariant]);
store.setDefault('compact');
store.getDefault();            // 'compact'
store.delete('compact');       // removes it AND clears the default
store.getDefault();            // undefined
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `delete` a name that is not present | No-op (silent) | AR-2 |
| `delete` the current default | Remove it **and** clear the default → `getDefault()` undefined | PF-026 |
| `save` a name already present | Overwrite in place (the dialog gates this behind confirm-overwrite) | RD-16 AR-49 |
| `list()` result mutated by a caller | Defensive copy / readonly — the store's array is not aliased | AR-2 |

> **Traceability:** see [00-ambiguity-register.md](00-ambiguity-register.md) and the RD register.

## Testing Requirements
- `createMemoryVariantStore`: save insert + overwrite-in-place; `list()` reflects mutations + is not aliased; `setDefault`/`getDefault` round-trip; **delete clears the default**; `getDefault()` undefined when none set. ST-9, ST-10, ST-11.
