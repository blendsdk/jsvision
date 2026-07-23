# 07 — Testing Strategy

> **Owning RD**: RD-08 §Acceptance Criteria (1–14) · **Register**: AR-61, AR-PL2, AR-PL5.

Specification-first: every `ST-D*` oracle below is written and **red** before the code that satisfies it
([99](99-execution-plan.md) sequences this). Spec tests are immutable oracles — a red spec after
implementation means the code is wrong, never the test. Expectations derive from RD-08's ACs, not from
imagined implementation behavior.

## Test files (AR-PL5)

| File | Kind | Holds |
|------|------|-------|
| `packages/forms/test/form-dialog.spec.test.ts` | spec (immutable) | ST-D-SUB1…3 + ST-D1…D10 |
| `packages/forms/test/form-dialog.impl.test.ts` | impl (internals/edges) | non-spec edges (button placement, focus, re-entrancy internals) |
| `packages/forms/test/form-dialog-security.spec.test.ts` | spec (immutable) | ST-D-SEC |
| `packages/forms/test/surface.impl.test.ts` | impl (existing, edited) | the 5→6 runtime-surface lock (AR-PL3, [03-02](03-02-submitting.md)) |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | spec (existing, edited) | ST-DS1 ([03-03](03-03-story.md)) |

## Headless harness (AR-PL5)

Mirrors `packages/files/test/openers.impl.test.ts:24-60`: `createEventLoop({ width, height }, { caps })`
+ a fake host `{ loop, desktop: { addWindow: (v) => loop.mount(v), removeWindow, bounds } }` +
`loop.emitCommand(Commands.ok | Commands.cancel)` + `loop.dispatch({ type: 'key', key: 'escape' })`. A
deferred-promise `onSubmit` helper (a `sleep`/manual-resolve, like `forms-load.story.ts`'s `sleep`) lets
a test observe `submitting()` mid-await. `caps` from `resolveCapabilities`. No real TTY, no network.

## `submitting()` oracles — asserted on `form.submit()` directly (AR-PL2)

These need no dialog — they lock the signal `formDialog` depends on ([03-02](03-02-submitting.md)).

| ID | Input → Expected | AC |
|----|------------------|----|
| **ST-D-SUB1** | A fresh form → `submitting() === false`. After a **sync-invalid** `submit()` resolves `false` → `submitting() === false` (cleared on the short-circuit path). | #1, #8 |
| **ST-D-SUB2** | `submit()` with an `onValid` that awaits a deferred promise: `submitting() === true` synchronously after the call and across the await; after it resolves `true` → `submitting() === false`. | #6, #8 |
| **ST-D-SUB3** | `submit()` with an `onValid` that **rejects**: `submit()` re-throws (asserted `await expect(...).rejects`), and after it settles `submitting() === false` (the `try/finally` cleared before the re-throw). | #7 |

## `formDialog` behavior oracles

Each opens a `formDialog` on the headless host over a fillable schema (e.g. `z.object({ name:
z.string().min(1), port: z.coerce.number().int().min(1) })`), then drives commands.

| ID | Input → Expected | AC |
|----|------------------|----|
| **ST-D1** | Make the form valid, `emitCommand(Commands.ok)` → the `formDialog` promise resolves to the **coerced** `z.output<S>` (e.g. `{ name, port: <number> }`); the dialog was `removeWindow`ed; `form.dispose()` ran (a post-close value write drives no effect — assert via a disposed-scope probe as RD-07's impl test does). | #2 |
| **ST-D2** | With a sync-invalid form, `emitCommand(Commands.ok)` → the promise is **not** resolved and the dialog is **not** removed (still mounted/modal); every field `touched() === true` (errors revealed). | #3 |
| **ST-D3** | A form whose `asyncValidators` rejects the current value; `emitCommand(Commands.ok)` → the async gate runs (`submit()` force-runs the validator), the dialog stays open, and `field.asyncError()` is set — proving OK went through the async `submit()`, not the sync `valid()` sweep. | #4 |
| **ST-D4** | (a) `emitCommand(Commands.cancel)` → promise resolves `null`, dialog removed, form disposed, no `onSubmit` called. (b) Separately, `dispatch({type:'key',key:'escape'})` → same: resolves `null`, removed, disposed. | #5 |
| **ST-D5** | An `onSubmit` that awaits a deferred promise; make valid, `emitCommand(Commands.ok)` → `submitting()` is `true` across the await; on resolve the dialog closes and the promise yields the coerced values; `onSubmit` was called **exactly once** with the coerced values. | #6 |
| **ST-D6** | An `onSubmit` that **rejects**; make valid, `emitCommand(Commands.ok)` → the dialog stays open (not removed), the promise is **not** resolved, `form.submitting()` returns to `false` (OK re-enabled), **no** unhandled rejection escapes; a subsequent successful OK (swap in a resolving `onSubmit`, or clear the reject) still resolves the values. | #7 |
| **ST-D7** | An `onSubmit` that awaits a deferred promise (dialog sealed while pending); make valid, `emitCommand(Commands.ok)` to start the gate, then **while `submitting()`**: a second `emitCommand(Commands.ok)`, an `emitCommand(Commands.cancel)`, and `dispatch(escape)` are each **inert** — the modal does not close and `onSubmit`/`submit` runs **exactly once**; resolve the deferred → OK completes, promise yields values. | #8 |
| **ST-D8** | Quit-veto via `valid('quit')` (the loop's default `quitCommand`, `event-loop.ts:332`): with a sync-invalid form `dlg.valid('quit') === false` (veto); with a sync-valid form `dlg.valid('quit') === true` (the non-veto path `modal.end('quit')` closes → resolves `null` since `'quit' !== 'ok'`); while `submitting()` `dlg.valid('quit') === false` (sealed). | #9 |
| **ST-D9** | Open then close (both OK and cancel, and a body/`onSubmit` that throws) → `form.dispose()` ran **exactly once** each time, in the same `finally` as `removeWindow`; opening+closing emits **no** unowned-computation dev warning (the `openers`-style owner guard). | #10 |
| **ST-D10** | `options.okText: 'Save'` → the OK button label is `Save`; OK is the `default` button. Firing **Enter** on the default OK button (`dispatch` the activating key) drives the **same** async OK gate as `emitCommand(Commands.ok)` (resolves the values on a valid form). | #11 |

## Security oracle

| ID | Input → Expected | AC |
|----|------------------|----|
| **ST-D-SEC** | A **string** field initialised/loaded with control bytes — `'a\x00b\x1b[31mc\x9b'` — bound to a widget in the dialog body, then render the mounted dialog to a `RenderRoot`/`ScreenBuffer` and scan every cell: **no** cell has a code point `< 0x20`, `=== 0x7f`, or in `0x80–0x9f` (the same render-and-scan oracle RD-04/RD-06/RD-07 use). Proves `formDialog` adds no raw-control render path. | #13 |

## Story smoke

| ID | Input → Expected | AC |
|----|------------------|----|
| **ST-DS1** | `kitchen-sink.smoke.spec.test.ts` mounts `forms/dialog` headlessly → it paints something, has the unique id `forms/dialog`, and carries required metadata (`category`, `title`, `blurb`). | #12 |

## Verify gate (not a discrete test — RD-08 AC #14)

`yarn verify` green (lint → typecheck/build/test/check:docs across the workspace) **and** a plain
banned-ref grep over `packages/forms/src` clean (AR-PL6): the `formDialog`/`FormDialogOptions`/
`submitting()` surface carries `@example`s (`check:docs` enforces `@example` on public exports); no
`RD-`/`AR-`/`codeops/` or TV/C++ refs in shipped code (grep, because `check-jsdoc.mjs` has scanner gaps
— see the project memory). The surface-lock update (5→6) is part of `yarn test`.

## AC → oracle coverage map (all 14)

| AC | Oracle(s) |
|----|-----------|
| #1 Barrel + surface | ST-D-SUB1 (`submitting()` false at rest) + `surface.impl.test.ts` 5→6 |
| #2 Valid OK → values + teardown | ST-D1 |
| #3 Invalid OK stays open | ST-D2 |
| #4 Async validator gates OK | ST-D3 |
| #5 Cancel / Esc → null + teardown | ST-D4 |
| #6 In-modal `onSubmit` inside gate | ST-D5 (+ ST-D-SUB2) |
| #7 `onSubmit` rejection stays open | ST-D6 (+ ST-D-SUB3) |
| #8 `submitting()` transitions + sealed | ST-D7 (+ ST-D-SUB1/2) |
| #9 Quit-veto sync `isValid()` | ST-D8 |
| #10 Owned + disposed once every path | ST-D9 |
| #11 `okText` + default button | ST-D10 |
| #12 Story + smoke | ST-DS1 |
| #13 Security control-byte | ST-D-SEC |
| #14 `yarn verify` + `check:docs` + grep | Verify gate (above) |
