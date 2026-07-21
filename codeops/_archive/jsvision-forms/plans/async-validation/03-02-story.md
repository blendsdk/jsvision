# 03-02 — Kitchen-sink Async Story

> **Document**: 03-02-story.md
> **Parent**: [Index](00-index.md)
> **Owns**: the async-validation showcase story + its smoke assertion (AR-45 / AC-14).
> **CodeOps Skills Version**: 3.7.0

## Decision: a new story, not an extension

Async validation is a distinct capability, so it gets its own story per the kitchen-sink contract
(add ONE `<x>.story.ts` exporting a `Story` + one line in `stories/index.ts`) rather than crowding
the existing `forms/form` story. The existing `forms.story.ts` (`id: 'forms/form'`, `rd: 'RD-04'`)
is **untouched**.

- **File**: `packages/examples/kitchen-sink/stories/forms-async.story.ts`
- **Registration**: import + one entry in `stories/index.ts` (beside `formsStory`).
- **Story**: `{ id: 'forms/async', category: 'Forms', title: 'Async validation', rd: 'RD-06',
  blurb, build(ctx) }`.

## What the story renders

A live "username availability" form that exercises the whole async surface with a **simulated**
in-memory check (no network — works on any TTY):

```ts
const TAKEN = new Set(['admin', 'root', 'guest']);           // simulated directory
const schema = z.object({ username: z.string().min(3, 'Min 3 chars') });
const form = createForm({
  schema,
  initial: { username: '' },
  asyncValidators: {
    username: async (value, { signal }) => {
      await sleep(500, signal);                                // simulated round-trip (abortable)
      return TAKEN.has(value.toLowerCase()) ? 'Already in use' : null;
    },
  },
  asyncDebounceMs: 300,
});
const field = form.field('username');
bindField(field, usernameInput);                              // touched-on-first-blur
```

Layout (absolutely-positioned children in `ctx.width × ctx.height`, per the contract — the shell
owns all chrome):

1. A `Label` "Username" + a live `Input` bound to `field.value` (with a `placeholder: 'try "admin"'`
   from RD-09 — soft-consumed, not a dependency).
2. A **live state echo** `Text` bound to the async state, so the demo is self-explaining:
   - `field.validating()` → `'checking…'` (muted),
   - else `field.asyncError()` → that message via `Text({ severity: 'error' })` (RD-09 styled `Text`,
     soft-consumed) — bind it as `() => field.asyncError() ?? ''` (the getter is typed `() => string`,
     but `asyncError()` is `string | null`) and only paint the `severity: 'error'` variant when
     `asyncError() !== null` so an empty string is never coloured danger-red,
   - else a non-empty valid value → `'✓ available'`.
3. A sync-error `Text` (touched-gated, app-composed) for the `min(3)` message — shows how `error()`
   (sync) and `asyncError()` (async) are **distinct** surfaces the app composes.
4. A `valid · validating` echo `Text` bound to `form.isValid()` / `form.validating()`.
5. A submit `Button` whose `disabled` binds `() => !form.isValid() || form.validating()` and whose
   action `await form.submit(...)` echoes the outcome — demonstrating the async-aware gate.
6. An always-painted **interaction hint** `Text`: e.g. `type a name — it shows "checking…" then
   availability; "admin"/"root"/"guest" are taken`. (This hint guarantees the literal demonstration
   strings paint even in a headless mount — see the smoke oracle.)

`sleep(ms, signal)` is a tiny local `Promise` + `setTimeout` that rejects/clears on `signal.abort`
— keeping the story self-contained (no new dependency; the debounce/abort are demonstrated live).

## Lifecycle note

`createForm`'s reactive scope is a **child of the ambient build scope** (`createRoot` parents to the
current owner — `owner.ts:74`), so the shell's per-story teardown disposes the async effects with the
story; the headless smoke test wraps `build()` in `createRoot`+`dispose` for the same reason. The
story therefore does not itself call `form.dispose()` (that seam is for the per-dialog RD-08 case);
it stays a pure `build(ctx) → Group`, touching neither desktop nor host.

## Smoke test (AC-14 / AR-45)

The story must pass `test/kitchen-sink.smoke.spec.test.ts`:

- The **generic** smoke loop (already present) mounts every registered story headlessly and asserts
  it paints — `forms/async` is covered automatically by registration.
- A **targeted** oracle **ST-AS1** (added, mirroring RD-09's ST-S1) builds `forms/async`, mounts it,
  and asserts the painted buffer contains the async-demo affordance — the literal `checking…` (from
  the always-painted hint) and the `Username` label — proving the async story renders its
  characteristic state, not just "something".

The story needs no TTY and advances no timers in the smoke test; its live behavior (debounce →
"checking…" → verdict) is exercised on a real terminal and by the store-level oracles in
[07](07-testing-strategy.md).
