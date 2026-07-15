# 03-01 — bindField + the touched-sink registry

Implements FR-3.2 and its write seam (PA-1…PA-4, PA-8). Two new modules plus a one-line edit to
`create-form.ts`.

## A. The touched-sink registry (PA-1) — `src/internal.ts`

**Not** barrel-exported. Keyed by `object` (handle identity) to avoid `Signal<T>` invariance friction
— no cast, no `any`:

```ts
/**
 * Package-internal seam: maps each field handle to a closure that marks it touched.
 * Keeping this off the public {@link Field} surface lets `bindField` set touched without
 * widening the handle shape, and keying by identity avoids any unsafe cast.
 */
export const touchedSinks = new WeakMap<object, () => void>();
```

**Registration** — in `create-form.ts`, at handle memoization (`create-form.ts:118-125`), add one line
after `handles.set(key, handle)`:

```ts
handles.set(key, handle);
touchedSinks.set(handle, () => touchedSignal(key).set(true)); // NEW: the sink writes the
                                                              // same store-internal touched signal
```

The sink is created lazily the first time `form.field(name)` is called — which is always before
`bindField(field, …)`, since the caller obtains the handle first. It writes the exact signal that
`field.touched()` reads and `reset()`/`submit()` drive, so there is one source of truth.

## B. `bindField` — `src/bind-field.ts`

```ts
export function bindField<T>(field: Field<T>, view: View): void
```

**Signature** (PA-4): generic `<T>` so any concrete `Field` is accepted, lint-clean, no cast.

**Idempotency guard** (PA-3), module-level:

```ts
const bound = new WeakMap<View, Set<object>>(); // (view → fields already wired), keyed by object
```

**Algorithm:**

1. `const mark = touchedSinks.get(field);` — a **foreign** handle (not produced by this package's
   `createForm`) misses ⇒ `throw new FormFieldError(field.name)` (fail fast, consistent with the
   unknown-key throw).
2. Idempotency: `let set = bound.get(view); if (set?.has(field)) return;` else create/extend the set
   and `set.add(field)`.
3. Wire the effect on mount via the **public** seam (PA-2):

```ts
view.onMount(() => {
  let was = view.state.focused;            // captured before the first run → no fire on mount
  view.bind(() => {
    view.focusSignal()();                  // subscribe: re-runs on every focus flip (PA-8)
    const now = view.state.focused;        // fresh — focusLeaf set it before poking (focus.ts)
    if (was && !now) mark();               // leave = was focused, now not
    was = now;
  });
  view.onCleanup(() => bound.get(view)?.delete(field)); // clear the guard so a LATER
                                                        // bindField(field, view) re-call can
                                                        // rewire; remount does NOT auto-rewire
                                                        // (this onMount callback does not re-fire)
});
```

**Why it satisfies the AC:**

- *Not on mount* — the first `bind` run reads `now === was` (the captured mount-time value) ⇒ no
  transition ⇒ `mark()` not called.
- *Exactly once on first leave* — the `was && !now` edge fires only on `focused: true → false`;
  `mark()` sets a boolean signal to `true` (an equal re-write is a no-op), so re-focus/re-blur cycles
  leave it `true`.
- *Cleaned up on unmount* — `view.bind`'s effect is owned by the view's scope and disposed when the
  view unmounts (`view.ts:355-357`); the `onCleanup` also clears the idempotency entry.

**Accepted cost (PA-2):** `view.bind` calls `invalidate()` on every focus flip (both enter and
leave). Redundant — `focusLeaf` already repaints the view on each focus change (`focus.ts:109,113`) —
and harmless (an idempotent mark into the dirty set).

## C. No module cycle

`internal.ts` imports only `type { Field }` from `./types.js`. `create-form.ts` imports the
`touchedSinks` value from `./internal.js`; `bind-field.ts` imports `touchedSinks` + `FormFieldError` +
the `Field` type, and the `View` type from `@jsvision/ui`. Dependency direction is acyclic
(`bind-field → internal → types`; `create-form → internal → types`).
