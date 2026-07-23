# RD-01: Form & Field Store

- **Priority:** Must
- **Depends on:** — (foundation)
- **Status:** Drafted

## Summary

The headless core of `@jsvision/forms`: a `createForm` factory that builds a reactive form/field
store over jsvision's Solid-style signals. It owns the raw editing values, exposes per-field handles
and form-level accessors, and produces a schema-coerced typed output. It holds **no view** and draws
nothing — binding to widgets is RD-03; validation mechanics are RD-02. The store is **owner-free**:
pure signals + lazy computeds, nothing to dispose.

## Functional requirements

### FR-1.1 — `createForm` factory & typing contract *(AR-18, AR-01)*
`createForm` accepts a Zod object schema and a raw `initial` object and returns a `Form`.

```ts
function createForm<S extends z.ZodObject<any>, I extends Record<keyof z.output<S>, unknown>>(
  options: { schema: S; initial: I },
): Form<S, I>;
```
- `initial`'s **keys are constrained to the schema's keys** (`keyof z.output<S>`); its **value types
  are the raw editing types the caller supplies** (e.g. `port: '8080'` ⇒ `string`).
- Rationale: text fields edit strings; a `z.coerce.number()` field is edited as a string and coerced
  by the schema. Deriving raw types from `initial` (not `z.input<S>`) keeps `field.value` precise.

### FR-1.2 — `Form` accessor surface
```ts
interface Form<S extends z.ZodObject<any>, I> {
  field<K extends keyof I>(name: K): Field<I[K]>;
  values(): z.output<S> | null;   // coerced, only when valid (RD-02)
  rawValues(): I;                 // raw snapshot — always
  errors(): ZodIssue[];           // form-level (path-less) issues (RD-02)
  isValid(): boolean;             // actual validity (RD-02)
  dirty(): boolean;               // any field dirty
  submit(onValid: (values: z.output<S>) => void | Promise<void>): Promise<boolean>;
  reset(): void;
}
```

### FR-1.3 — `Field` handle shape *(AR-14)*
```ts
interface Field<T> {
  readonly name: string;
  readonly value: Signal<T>;   // the raw editing signal the store OWNS (widgets bind it directly)
  error(): ZodIssue | null;    // first issue for this field (RD-02)
  touched(): boolean;          // flips on first blur / submit (RD-02, RD-03)
  dirty(): boolean;            // raw value ≠ baseline
}
```
`disabled`/`readonly` are **not** part of the handle this slice (deferred, AR-17).

### FR-1.4 — Value model: `field.value` is the store-owned raw signal *(AR-01)*
`field.value` returns the **same** `Signal<T>` reference the store owns (no copy, no adapter for
text/switch). A widget bound to it writes straight into the store; validation reads the same cell.
The raw type per field: text ⇒ `string`; choice fields carry the **domain** value (RD-03 covers the
adapters). `initial` is the raw representation, not `z.infer`.

### FR-1.5 — Stable, memoized field handles *(AR-21)*
`form.field(name)` returns the **same** `Field` instance on every call for a given name — identical
`value`/`touched`/`dirty` signals. Correctness depends on this: `bindField` and the UI must observe
one shared touched signal.

### FR-1.6 — `rawValues()` and `values()` *(AR-06, AR-01)*
- `rawValues()` returns the live raw snapshot `{ [K]: field(K).value() }` — **always** available.
- `values()` returns the schema-coerced `z.output<S>` **only when the form is valid**, else `null`
  (a live computed; never throws). Coercion happens once, in the schema (RD-02).

### FR-1.7 — Dirty tracking & baseline *(AR-12)*
- `field.dirty()` = the field's raw value ≠ its baseline; `form.dirty()` = any field dirty.
- Baseline = the `initial` object, **immutable in this slice** (no async-load rebase).
- Equality: `Object.is` for string/number/boolean; element-wise for array values (e.g. check groups).

### FR-1.8 — `reset()` *(AR-13)*
`form.reset()` restores every field's `value` to baseline in a single `batch()`, and clears every
field's `touched` flag and the form's submit-attempted flag. Per-field `field.reset()` is deferred.

### FR-1.9 — `isValid()` *(AR-03)*
`isValid()` reflects **actual** whole-object validity (the schema passes), independent of `touched`.
It is the gate a Save button binds to; it is live pre-touch (so an all-empty required form is
`false` from the start).

### FR-1.10 — `submit(onValid)` *(AR-07)*
`form.submit(onValid)` (a) marks **all** fields touched, (b) validates, (c) if invalid resolves
`false` (errors now visible everywhere), (d) if valid awaits `onValid(values)` — where `values` is
the coerced `z.output<S>` — then resolves `true`. Return type `Promise<boolean>`; a synchronous
`onValid` simply resolves immediately. `submitting()` state is deferred (AR-17).

### FR-1.11 — Unknown field key *(AR-19)*
`form.field(name)` with a name not in the schema (reachable only via a cast/dynamic string, since
`keyof` blocks it at compile time) **throws** `FormFieldError` with a message naming the field.

### FR-1.12 — Owner-free public lifecycle *(AR-15, refined by the plan's PA-1)*
`createForm` exposes **no** `form.dispose()` and creates no effects. Internally it wraps its **lazy**
computeds in a `createRoot` scope so they are owned (avoiding the reactive core's owner-less
dev-warning) — disposed with the ambient scope when nested, GC'd at module scope. It is safe to call
at module scope or inside a component scope. (The only reactive effects in the engine are
touched-wiring, which live in the view scope via `bindField`, RD-03.)

## Acceptance criteria

- [ ] `createForm({ schema, initial })` returns a `Form`; `field('x').value` is typed from `initial`
      (`Signal<string>` for a string-initialised field), `values()` is typed `z.output<S> | null`.
- [ ] `field(name)` returns a stable handle (`form.field('a') === form.field('a')`).
- [ ] `rawValues()` always returns the current raw snapshot; `values()` returns the coerced object
      when valid and `null` when invalid, without throwing.
- [ ] `field.dirty()`/`form.dirty()` reflect divergence from `initial`; array fields compare
      element-wise; `reset()` clears dirty + touched in one batch.
- [ ] `isValid()` is `false` for an all-empty required form and flips `true` once satisfied, pre-touch.
- [ ] `submit(onValid)` marks all touched, resolves `false` on invalid (no `onValid` call), and on
      valid awaits `onValid(coercedValues)` and resolves `true`.
- [ ] `field('unknown' as never)` throws `FormFieldError`.
- [ ] No `dispose()` exists and no effect leaks when a form is created and discarded.

## Out of scope
Async loading/rebase, per-field reset, `disabled`/`readonly`, `submitting()`, nested/array-of-object
fields (all AR-17). Validation mechanics → RD-02. Widget binding → RD-03.

## Traceability
AR-01, AR-06, AR-07, AR-12, AR-13, AR-14, AR-15, AR-18, AR-19, AR-21.
