# Testing Strategy — widget-binding

Specification-first: the **ST oracles below derive from RD-03's acceptance criteria**, not from the
implementation. A failing spec test after implementation means the code is wrong, never the test.
`Input`/`Switch`/`RadioGroup`/`CheckGroup` are exercised as real widgets (no mocks); focus **leave
detection** is driven through a **real `EventLoop`** so the specs can't encode a mis-decode of the
focus-order (PA-8). The one deliberate exception is ST-03's *post-unmount* check: a detached view has
no focus manager to drive it through the loop, so that sub-case hand-pokes to prove the effect is
gone.

**Shared helpers** (in the spec files): `caps = resolveCapabilities({ env: {}, platform: 'linux' })
.profile`; `key(k) = { type: 'key', key: k, ctrl: false, alt: false, shift: false }`; a `mount(root)`
that returns a `createEventLoop({ width, height }, { caps })` after `loop.mount(root)`.

## Specification test cases (ST) → files

### `test/bind-field.spec.test.ts` — widget-layer specs (real loop)

- **ST-01 — direct text bind is two-way (AC-1, FR-3.1).**
  `schema = z.object({ name: z.string().min(1, 'Required') })`, `initial { name: '' }`.
  `input = new Input({ value: form.field('name').value })`, mounted + focused.
  - widget→store: `dispatch(key('d')); dispatch(key('b'))` ⇒ `field.value() === 'db'`,
    `form.values()` deep-equals `{ name: 'db' }`, `form.isValid() === true`.
  - store→widget: `field.value.set('x')` ⇒ the input's rendered row contains `x`.

- **ST-02 — direct boolean bind is two-way (FR-3.1).**
  `schema = z.object({ on: z.boolean() })`, `initial { on: false }`.
  `switch = new Switch({ value: form.field('on').value })`, mounted + focused.
  - widget→store: `dispatch(key('space'))` ⇒ `field.value() === true`, `form.values().on === true`.
  - store→widget: `field.value.set(false)` ⇒ the switch renders the off state.

- **ST-03 — `bindField` touched-on-blur (AC-2, FR-3.2, PA-8).**
  Two focusable inputs (`inputA`/`inputB`) under one root; `bindField(fieldA, inputA)`.
  - not on mount: after mount, `fieldA.touched() === false`.
  - not on enter: `loop.focusView(inputA)` ⇒ `fieldA.touched() === false`.
  - on first leave: `loop.focusView(inputB)` ⇒ `fieldA.touched() === true`.
  - cleaned up on unmount: with a fresh field/input focused-in (touched still `false`),
    `root.remove(inputA)` (dispose), then a would-be leave (`inputA.state.focused = false;
    inputA.focusSignal().set(undefined)`) leaves `touched === false` — the effect is gone.

### `test/adapters.spec.test.ts` — lens specs (pure + one end-to-end)

- **ST-04 — `bindRadio` lens (AC-3, FR-3.3).**
  `field.value` domain `'a'|'b'|'c'`; `sel = bindRadio(field, ['a','b','c'])`.
  - `sel() === 0` initially; `sel.set(1)` ⇒ `field.value() === 'b'`; setting the field to a value not
    in `options` ⇒ `sel() === -1`; `sel.peek()` does not subscribe (reading it inside no tracked
    scope leaves it inert — asserted via an `effect` run-count).

- **ST-05 — `bindCheck` lens (AC-4, FR-3.4).**
  `field.value` domain `Array<'x'|'y'|'z'>`; `chk = bindCheck(field, ['x','y','z'])`.
  - `field.value` `['x','z']` ⇒ `chk()` deep-equals `[true, false, true]`.
  - `chk.set([false, true, true])` ⇒ `field.value()` deep-equals `['y','z']` (option order preserved).
  - toggling one flag updates the selected-values array accordingly.

- **ST-06 — choice widgets keep the schema in domain terms (AC-5).**
  `schema = z.object({ align: z.enum(['left','center','right']) })`, `initial { align: 'left' }`.
  `new RadioGroup({ labels, value: bindRadio(form.field('align'), ['left','center','right']) })`;
  driving the group's selection to index 2 ⇒ `form.values()` deep-equals `{ align: 'right' }` and
  `form.isValid() === true` — validation ran on the **domain enum**, never an index. The `bindCheck`
  half asserts the same for `z.array(z.enum([...]))`.

- **ST-07 — adapters are pure lenses (FR-3.5).**
  Two `bindRadio` calls on the same field behave equivalently; a lens created and then dropped leaves
  `field.value` unchanged (no stored state, nothing to dispose).

## Implementation test cases (impl) → `test/bind-field.impl.test.ts` + `test/adapters.impl.test.ts`

- `bindField` idempotent per (field, view) (PA-3): a repeat `bindField(field, view)` wires the effect
  **once** — asserted by spying that `view.bind` (or `onMount`) is invoked a single time.
- `bindField` throws `FormFieldError` for a **foreign** field handle (not from this `createForm`) (PA-1).
- `bindField` focus-*in* without a subsequent leave never sets touched; repeated enter/leave cycles
  keep touched `true`.
- `bindRadio.update(fn)` / `bindCheck.update(fn)` route through `set(fn(peek()))`.
- `bindRadio.set(i)` out of range writes `undefined` (documented no-guard, PA-6).
- `bindCheck.set` with a shorter/longer flag array; empty `options`.
- direct bind store→widget for both `Input` and `Switch` (the reverse of ST-01/02).

## Verify

Per task: `yarn workspace @jsvision/forms test`. Phase gate: `yarn verify` (lint → typecheck → build
→ test → check:docs). `check:docs` enforces `@example` on every new export and bans process-ID / plan
/ Turbo-Vision references in shipped comments.
