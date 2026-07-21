# 03-02 — bindRadio / bindCheck (stateless lenses)

Implements FR-3.3 / FR-3.4 / FR-3.5. One module: `src/bind-choice.ts`. Each helper returns a `Signal`
that reads from and writes to `field.value` **only** — no stored state, no cleanup (FR-3.5). Built
like the stock `signal()`: `Object.assign(read, { peek, set, update })` (mirrors
`packages/ui/src/reactive/signal.ts:63-67`), but the three accessors project through `field.value`.

## A. `bindRadio` — domain value ⇄ selected index

```ts
export function bindRadio<T>(field: Field<T>, options: readonly T[]): Signal<number>
```

| Accessor | Behavior |
|----------|----------|
| `()` (read, subscribes) | `options.indexOf(field.value())` → `-1` when the value is not in `options` |
| `.peek()` (no subscribe) | `options.indexOf(field.value.peek())` |
| `.set(i)` | `field.value.set(options[i])` |
| `.update(fn)` | `this.set(fn(this.peek()))` |

- Reading subscribes because it calls `field.value()`; `RadioGroup`'s `bind` re-runs (repaints) when
  the domain value changes, and its constructor read (`radio-group.ts:44`) works outside any tracked
  scope (`field.value()` there just reads).
- **Out-of-range `.set`** (PA-6): `options[i]` is `undefined` for `i < 0` / `i ≥ length`; **no
  guard** — `RadioGroup` only ever sets `0..n-1`. The JSDoc tells the caller to seed a valid
  `initial` (or a schema default) so the first read isn't `-1`.
- Bound: `new RadioGroup({ labels, value: bindRadio(field, options) })`.

## B. `bindCheck` — selected-values array ⇄ per-option flags

```ts
export function bindCheck<T>(field: Field<T[]>, options: readonly T[]): Signal<boolean[]>
```

Domain value is `Signal<T[]>` — the **selected values** (a `z.array(z.enum)` field), not positional
flags.

| Accessor | Behavior |
|----------|----------|
| `()` (read, subscribes) | `options.map((o) => field.value().includes(o))` — one flag per option, option order preserved |
| `.peek()` | same over `field.value.peek()` |
| `.set(flags)` | `field.value.set(options.filter((_, i) => flags[i]))` — keeps only options whose flag is truthy, in option order |
| `.update(fn)` | `this.set(fn(this.peek()))` |

- Membership is set-based (`includes`), so a domain array in any order still maps to the correct
  flags; the written-back array is always in option order.
- `CheckGroup` writes a normalized full-length flag array (`check-group.ts:53-58`), so `.set` always
  receives a length-`options.length` array in practice; `filter` tolerates a short/long array either
  way.
- **Values outside `options` are not round-tripped** — `.set` only ever writes members of `options`,
  so a domain value not in `options` is dropped on the first widget write-back (the multi-select twin
  of `bindRadio`'s out-of-range `-1`, PA-6). Keep `options` equal to the field's `z.enum` (AR-08
  models it as `z.array(z.enum([...options]))`, so an out-of-`options` value is invalid by
  construction).
- Bound: `new CheckGroup({ labels, value: bindCheck(field, options) })`.

## C. Purity (FR-3.5)

Neither lens holds a subscription or any mutable cell of its own — the **widget's** `bind` owns the
subscription to `field.value`. Consequences the tests pin:

- Two lenses over the same field behave equivalently.
- Disposing a widget bound to a lens leaves the field untouched (nothing to clean up).
- Touched for a choice widget is **not** wired by the adapter — the caller adds
  `bindField(field, radioOrCheckView)` separately.
