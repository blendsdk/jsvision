# Current State — widget-binding

The store (RD-01/02) shipped in `@jsvision/forms`; this plan adds only the binding helpers. The four
seams they ride, grounded in the current code:

## 1. The Field handle (the store side)

- `Field<T>` (`packages/forms/src/types.ts:10-21`): `name`, `value: Signal<T>`, `error()`,
  `touched(): boolean` — a **getter only** — and `dirty()`.
- There is **no** touched *setter*: `touchedSignals` is a store-internal map
  (`packages/forms/src/create-form.ts:77,81,94-98`) and the handle is a plain object literal
  (`:118-124`). ⇒ `bindField` needs a new write seam without touching the public shape (PA-1).
- Handles are **stable/memoized** per name (`:110-127`, AR-21) — the sink registered against a
  handle, `bindField`, and the UI all observe the one shared touched signal.
- `reset()` and `submit()` already drive the same touched signals (`:135,143`) — the sink writes
  that one source of truth, so touched stays consistent.

## 2. The Signal contract (what a lens must satisfy)

`Signal<T>` (`packages/ui/src/reactive/types.ts:19-28`) is a callable accessor `(): T` (subscribes
inside a tracked computation) plus `.set(v)`, `.update(fn)`, `.peek()`. The stock `signal()` builds
it as `Object.assign(read, { peek, set, update })` (`packages/ui/src/reactive/signal.ts:63-67`) — a
lens mirrors exactly that shape, but `read`/`peek`/`set` project through `field.value` instead of
holding their own cell.

## 3. The widget value seams (what direct bind + the lenses feed)

- **Input** binds two-way over `Signal<string>`; it writes the bound signal on each keystroke — the
  proven idiom is `const v = signal(''); new Input({ value: v }); loop.dispatch(key('a'));
  expect(v()).toBe('a')` (`packages/ui/test/controls.input.spec.test.ts:59-62`). `field.value` is a
  `Signal<string>`, so it drops in directly.
- **Switch** binds over `Signal<boolean>` (Space/Enter/click toggle) — `field.value` (`Signal<boolean>`)
  drops in directly.
- **RadioGroup** consumes `value: Signal<number>` — it reads `value()` in its constructor
  (`packages/ui/src/controls/radio-group.ts:44`) and in `bind` on mount (`:46`), and writes
  `value.set(i)` on select (`:54,58`). The lens `read()` must therefore be safe to call outside a
  tracked scope (it is — `field.value()` there simply reads without subscribing).
- **CheckGroup** consumes `value: Signal<boolean[]>` — reads `value()` (`check-group.ts:46,50`),
  writes a normalized full-length array (`:53-58`).

## 4. The focus seam (what `bindField` hooks)

- `View.focusSignal(): Signal<void>` (`packages/ui/src/view/view.ts:136`, `equals: () => false` so it
  notifies on **every** poke) and `state.focused` (`view.ts:67`) are public.
- **Load-bearing ordering (PA-8):** `focusLeaf` sets `state.focused` **before** poking `focusTick`
  (`packages/ui/src/event/focus.ts:103-115`) — for the losing view: `old.state.focused = false` then
  `old.focusTick?.set(undefined)`. So a focus-driven effect re-runs *after* the flag settles; leave =
  `was === true && state.focused === false`.
- `view.bind(reader)` (`view.ts:228-240`) runs an effect **owned by the view's scope**, re-running
  when `reader`'s signals change, disposed at unmount (`view.ts:355-357`). This is the PA-2 seam; it
  must be called from `onMount` (the scope exists only once mounted).

## 5. Barrel / imports / dependency surface

- `@jsvision/ui` exports `View` (`packages/ui/src/index.ts:46`) and re-exports the reactive core —
  `effect`, `onCleanup`, `runWithOwner`, `signal`, `batch`, and the `Signal` type
  (`index.ts:42`). `create-form.ts` already imports `{ batch, createRoot, signal }` + the `Signal`
  type from `@jsvision/ui`.
- The new code imports the **`View` type** (type-only) and needs no runtime import beyond the view
  instance's own `onMount`/`bind` methods. **`@jsvision/forms` gains no new dependency.**

## 6. Test infrastructure (how the specs drive it)

The `bindField`/direct-bind specs mount widgets in a real loop: `createEventLoop({ width, height },
{ caps })` → `loop.mount(root)` → `loop.focusView(view)` / `loop.dispatch(key(ch))`
(`packages/ui/test/event.focus.spec.test.ts:54-57`, `controls.input.spec.test.ts:59-62`), with
`caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile` and a `key(k)` helper returning
`{ type: 'key', key: k, ctrl: false, alt: false, shift: false }`. The adapter specs are mostly pure
(signal-level), needing no mount.
