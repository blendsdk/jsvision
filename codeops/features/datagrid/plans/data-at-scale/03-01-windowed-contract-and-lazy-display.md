# 03-01 — Windowed Contract & Lazy Display

**Owns:** the `GridDataSource` `revision?()` addition, `isWindowed` detection, the length-correct lazy
`Proxy` `display()` that skips `materialize`, and the repaint reactivity. New module: `windowing.ts`.
Pins: ST-1…ST-4. ([AR-2](00-ambiguity-register.md), [AR-3](00-ambiguity-register.md), [AR-17](00-ambiguity-register.md))

## The contract addition — `revision?()`

Add one optional member to `GridDataSource<T>` (`data-source.ts`):

```ts
/**
 * A reactive revision counter for a windowed/async source: read inside the grid's display
 * derivation, so a bump (a fetched window has landed) re-derives the display and repaints the
 * newly-loaded rows. MUST be a tracked signal read (e.g. the getter of a `signal<number>`), not a
 * plain counter — a non-reactive read never subscribes and the grid never repaints on resolve.
 * Omit for an eager in-memory source (its rows signal already drives repaint).
 */
revision?(): number;
```

No other contract change. `ensureRange`, `rowAt`, `length`, `setSort`, `setFilter`, `distinct`,
`complete`, `insert`, `remove` already exist. `ensureRange` keeps its `void | Promise<void>` return —
the `Promise` is used by the coalescer for prefetch de-dup / test-settle (03-02), **never** as the
repaint trigger ([AR-3](00-ambiguity-register.md)).

## `isWindowed` detection

A source is windowed iff it exposes `ensureRange`:

```ts
// windowing.ts
export function isWindowed<T>(source: GridDataSource<T>): boolean {
  return typeof source.ensureRange === 'function';
}
```

This single predicate gates every windowed branch in the plan. The eager path (`ensureRange` absent)
never evaluates any windowed code → byte-identical to today.

## The lazy `Proxy` `display()`

On the windowed path, `display()` must be **length-correct** (`.length === source.length()`) so the
inherited `GridRows` reads (`focusTo`/`super.updateTop`/`super.onEvent`, see 02) keep working, while
materializing **only** the touched window. A `Proxy` over an empty array is the O(1)-allocation way to
present a `T[]` face with lazy semantics (the spike's proven shape, `windowed-source.ts:71-88`):

```ts
// windowing.ts
/**
 * A length-correct, lazily-read view over a windowed source, presentable as the `display: () => T[]`
 * the grid body demands. `.length` reports the source total; an integer index returns the loaded row
 * or `undefined` (never collapsing holes). Full-array methods (`map`/`find`/spread/`for..of`) are
 * intentionally NOT supported for windowed use — every such consumer is gated off by `isWindowed`
 * (see 03-03). Rather than trust that inventory, the Proxy **fails loud**: any non-`length`,
 * non-integer-index access throws, turning a missed gate into a located test failure.
 */
export function windowedView<T>(source: GridDataSource<T>): T[] {
  const unsupported = (prop: string | symbol): never => {
    throw new Error(
      `windowed display() supports only .length and integer indexing — "${String(prop)}" is a whole-array ` +
        `operation. Gate this consumer behind isWindowed(source) (see 03-03), or read source.rowAt(i) directly.`,
    );
  };
  return new Proxy<T[]>([], {
    get(target, prop, recv) {
      if (prop === 'length') return source.length();
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return source.rowAt(Number(prop));
      // Fail LOUD: any whole-array access (`.map`/`.find`/`.reduce`/…, all string props) or
      // `for..of`/spread (`Symbol.iterator`) throws — so an un-gated or future consumer is a
      // deterministic, located test failure, never a silent full-scan / fetch-storm. Engine/tooling
      // symbol probes (`toStringTag`, inspect, …) pass through. The base reads ONLY `.length` +
      // integer index (verified in 02), so no legitimate string access is lost; curate this allowlist
      // against the eager-vs-windowed test matrix if a base access ever surfaces.
      if (prop === Symbol.iterator || typeof prop === 'string') return unsupported(prop);
      return Reflect.get(target, prop, recv);
    },
    has(target, prop) {
      if (prop === 'length') return true;
      if (typeof prop === 'string' && /^\d+$/.test(prop)) return Number(prop) < source.length();
      return Reflect.has(target, prop);
    },
  });
}
```

**Type honesty + fail-loud invariant:** the view is typed `T[]` but yields `undefined` at unloaded
holes, and supports **only** `.length` and integer indexing. Rather than *trust* the 03-03 gate
inventory to stay complete, the Proxy **enforces** the contract — any whole-array access throws. This
matters because an unenforced Proxy does **not** degrade to an empty array: empirically, an ungated
`.map`/`.find`/`.findIndex`/spread **throws** on the first unloaded row (the callback dereferences
`undefined`, e.g. `rowKey(undefined)`) or, if the callback tolerates `undefined`, **full-scans** —
`rowAt(0…length())`, each miss kicking a page fetch (a fetch-storm). Failing loud converts that whole
class of "missed gate" bugs into deterministic, located test failures under the eager-vs-windowed
matrix. The only consumers that legitimately observe a hole are (a) the body's own window-indexing
sites, `undefined`-guarded in 03-02, and (b) the inherited base, which reads only `.length` and
`display[index]` (verified: no `.map`/spread anywhere in `grid-rows.ts` / `editable-grid-rows.ts`).
([preflight PF-003](00-preflight-report.md))

## Wiring into the `display` computed

`grid.ts:415-421` becomes windowed-aware, reading `revision()` so a landed page re-derives:

```ts
this.display = this.derived(() => {
  this.version();
  this.source.revision?.();            // windowed: a landed page bumps this → fresh identity → repaint
  if (isWindowed(this.source)) {
    return windowedView(this.source);  // length-correct lazy view; NO materialize, NO client sort/filter
  }
  let rows = materialize(this.source); // eager path — unchanged
  if (!this.source.setFilter) rows = filterRows(rows, this.filters(), this.columnMap);
  if (!this.source.setSort) rows = sortRowsMulti(rows, this.sortKeys(), this.columnMap);
  return rows;
});
```

- On the windowed path, client `filterRows`/`sortRowsMulti` are structurally skipped (they can't run
  on partial data) — the push-down effects (`grid.ts:452-465`) already forward the models to the
  source, and 03-03 enforces the push-down requirement.
- `this.version()` is still read first so an in-place windowed cell edit repaints its row.
- `this.source.revision?.()` is a no-op read for an eager source (member absent) — no behavior change.

## Construction-time validation & auto-width guard (delegated)

The `isWindowed` predicate is computed once at construction and reused by:
- the push-down / distinct requirement check ([AR-7](00-ambiguity-register.md), spec'd in 03-03),
- the auto-width guard: `autoWidths` (`grid.ts:422`) must **not** invoke `measureAutoWidths` over a
  windowed source; it returns the fixed/`fr` widths directly, `devWarn`-ing any `auto` column
  ([AR-8](00-ambiguity-register.md), spec'd in 03-03).

## Repaint failure mode to guard against

The worst failure is a source author returning a **plain, non-reactive** `revision` counter: the
`display` bind never subscribes and the grid never repaints when a page lands (green in a test that
manually pumps a frame, dead in production). Mitigations:
1. The JSDoc explicitly requires a tracked signal read.
2. The shipped helper source (03-04) wires `revision` to a real `signal<number>` — the copy-paste
   reference for correct usage.
3. ST-3 asserts a `revision` bump produces a fresh `display()` identity (proves the reactive read).

## ST coverage (see 07)

- **ST-1** — windowed `display().length === source.length()` even with holes; `materialize` not called.
- **ST-2** — `display()[i]` returns the row for a loaded index, `undefined` for an unloaded one.
- **ST-3** — a `revision` bump re-derives `display()` to a fresh identity (repaint fires).
- **ST-4** — an eager source still takes the `materialize` dense path (regression guard).
