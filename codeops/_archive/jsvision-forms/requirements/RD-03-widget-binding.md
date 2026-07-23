# RD-03: Widget Binding

- **Priority:** Must
- **Depends on:** RD-01, RD-02
- **Status:** Drafted

## Summary

The bridge between a `Field` and a jsvision widget. Text and boolean widgets bind their signal
directly; choice widgets (`RadioGroup`, `CheckGroup`) bind through **stateless domain-value
adapters** so the schema stays natural (`z.enum`, not indices). A single `bindField` helper wires
touched-on-blur for any widget. No widget-architecture change is required — everything rides the
existing `Signal<T>` seams and public `View.focusSignal()`.

## Functional requirements

### FR-3.1 — Direct binding for text and boolean *(AR-01)*
For a text field, `new Input({ value: field.value })` binds two-way with no adapter (`field.value`
is `Signal<string>`). For a boolean field, `new Switch({ value: field.value })` binds directly
(`Signal<boolean>`). The domain type equals the widget-native type.

### FR-3.2 — `bindField(field, view)` touched wiring *(AR-09, AR-05)*
```ts
function bindField(field: Field<any>, view: View): void;
```
Hooks the view's `focusSignal()` + `state.focused` so that on **focus-leave** (was focused → now
not) it sets `field`'s touched to `true`. Works for **any** `View` (Input/Switch/RadioGroup/
CheckGroup/custom). The effect lives in the view's reactive scope (created on mount), so it is
cleaned up with the view — the store stays owner-free (RD-01 FR-1.12). Idempotent per (field, view);
must not fire on initial mount and must not double-fire.

Grounding: `View.focusSignal(): Signal<void>` (`packages/ui/src/view/view.ts:136`) and
`state.focused` (`:67`) are public.

### FR-3.3 — `bindRadio(field, options)` adapter *(AR-08)*
```ts
function bindRadio<T>(field: Field<T>, options: readonly T[]): Signal<number>;
```
Returns a **stateless lens** `Signal<number>` over `field.value` (the domain value):
- read = `options.indexOf(field.value())` (subscribes to `field.value`);
- `.set(i)` / `.update(fn)` write `field.value.set(options[i])`;
- `.peek()` reads without subscribing.
No stored state, no cleanup. If `field.value()` is not in `options`, `indexOf` returns `-1` (no
selection) — the caller seeds a valid `initial` (or a schema default). Bound as
`new RadioGroup({ labels, value: bindRadio(field, options) })`.

### FR-3.4 — `bindCheck(field, options)` adapter *(AR-08)*
```ts
function bindCheck<T>(field: Field<T[]>, options: readonly T[]): Signal<boolean[]>;
```
For a multi-select field whose **domain value is `Signal<T[]>` (the selected values)**. Returns a
stateless lens `Signal<boolean[]>` (one flag per option, by position):
- read = `options.map(o => field.value().includes(o))`;
- `.set(flags)` / `.update` write `field.value.set(options.filter((_, i) => flags[i]))`.
Bound as `new CheckGroup({ labels, value: bindCheck(field, options) })`. Preserves option order;
selection membership is set-based, not positional in the domain value.

### FR-3.5 — Adapters are pure lenses
`bindRadio`/`bindCheck` hold no independent state — they read from and write to `field.value` only.
Two calls with the same field produce equivalent behavior; disposing a widget bound to an adapter
leaves the field untouched. Touched for a choice widget is wired separately via `bindField`.

## Acceptance criteria

- [ ] `new Input({ value: field.value })` on a text field is fully two-way (keystroke → store →
      validation) with no adapter.
- [ ] `bindField(field, view)` sets touched exactly once on first focus-leave, never on mount, and is
      cleaned up when the view unmounts.
- [ ] `bindRadio(field, ['a','b','c'])` returns a `Signal<number>`: reading reflects
      `indexOf(field.value())`; setting index `1` sets `field.value` to `'b'`; an out-of-set value
      reads `-1`.
- [ ] `bindCheck(field, ['x','y','z'])` maps `field.value()` `['x','z']` ⇄ `[true,false,true]` both
      directions; toggling a flag updates the selected-values array.
- [ ] Choice widgets bound via adapters keep the schema in domain terms (`z.enum`, `z.array(z.enum)`).

## Out of scope
Widget-factory sugar (`fieldInput`/`fieldSwitch`), `Input` placeholder, `disabled`/`readonly`
propagation (all AR-17).

## Traceability
AR-01, AR-05, AR-08, AR-09.
