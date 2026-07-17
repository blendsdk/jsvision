# 03-02 — `form.submitting()` + barrel surface

> **Files**: `packages/forms/src/create-form.ts`, `packages/forms/src/types.ts`,
>   `packages/forms/src/index.ts`, `packages/forms/test/surface.impl.test.ts` · **Owning RD**: RD-08 FR
>   "`form.submitting()` signal" + §"`submitting()` orchestration" · **Register**: AR-57, AR-PL3.

Two additive changes: the new `submitting()` signal on the store (the OK gate's seal + double-submit
guard depend on it — [03-01](03-01-form-dialog.md)), and the barrel export of `formDialog` +
`FormDialogOptions` with the surface-lock bump. Grounded in [02-current-state.md](02-current-state.md).

## `submitting()` — the in-flight signal (AR-57)

`Form` gains `submitting(): boolean` — `true` from the moment `submit()` begins until it settles
(validators **and** `onValid`/`onSubmit`), `false` on **every** return path. Form-level, independent of
`isValid()`/`loading()`/`validating()` — it completes the in-flight-state trio. Resolves RD-07's AR-45
deferral. It is a **pure observation** of the existing `submit()` lifecycle — no change to `submit()`'s
gate semantics or its `Promise<boolean>` contract.

### `create-form.ts` edits

1. **Seed the signal** beside `submitAttempted` (`:121`) / `loading` (`:127`):
   `const submitting = signal(false);`
2. **Wrap `submit()`** (`:213-230`) so `submitting()` is `true` across the whole body and `false` on
   **every** exit — including the four early `return false` paths and a **throwing** `onValid`. Because
   `submit()` awaits `onValid` with no try/catch (`:228`, [02](02-current-state.md)), the clear must be a
   `try/finally`, not a clear-before-each-return:

   ```ts
   const submit = async (onValid) => {
     submitting.set(true);                 // synchronous entry — the dialog's seal reads this at once
     try {
       batch(() => { /* touch all + submitAttempted, as today (:214-217) */ });
       if (!validation.isValid()) return false;
       asyncLayer.cancelPendingDebounces();
       await asyncLayer.runAllForced();
       if (!isValidForm()) return false;
       const coerced = validation.values();
       if (coerced === null) return false;
       await onValid(coerced);             // may reject → submit() re-throws; finally still clears
       return true;
     } finally {
       submitting.set(false);              // clears on every path: 4× return false, return true, AND a throw
     }
   };
   ```

   - **`submitting.set(true)` is synchronous at entry** so a caller/dialog observing right after invoking
     `submit()` (before the first `await`) already sees `true` — the dialog's seal + the OK button's
     `disabled: () => form.submitting()` rely on this (RD-08 AC #8, [03-01](03-01-form-dialog.md)).
   - **The `finally` clears before a re-throw propagates** — so on an `onSubmit` rejection the seal lifts
     and OK re-enables, then the OK gate's `catch` sees the dialog already unsealed (RD-08 AC #7).
   - **`submitting.set(true)` sits outside/before the `batch`** (or first inside it) — it is a single
     signal write; the exact placement relative to the touch-all `batch` has no observable difference
     since nothing reads `submitting()` synchronously between the two writes. Keep it as the first line for
     clarity.

3. **Expose it** on the returned object (`:266-279`), between `validating` and `loading` (mirroring the
   interface order): `submitting: () => submitting(),`.

### `types.ts` edit

Add `submitting(): boolean;` to `interface Form<S, I>` (`types.ts:59-119`), placed between `validating()`
(`:77-78`) and `loading()` (`:79-84`), with prose JSDoc (no per-member `@example` — the interface's
existing members carry none; the `@example` lives on `createForm`/`formDialog`). JSDoc states: true while
a `submit()` is in flight (validators **and** `onValid`); form-level; completes the
`loading()`/`validating()`/`submitting()` trio; a body may bind a busy indicator or `disabled` to it.

## Barrel + surface lock (AR-PL3)

### `index.ts` edits

Add two exports:
- Runtime: `export { formDialog } from './form-dialog.js';`
- Type: extend the type-only line — `export type { Form, Field, CreateFormOptions, AsyncValidator,
  FormDialogOptions } from './types.js';` **or** export `FormDialogOptions` from `./form-dialog.js`
  alongside `formDialog`. **Decision**: `FormDialogOptions` is declared in `form-dialog.ts`
  ([03-01](03-01-form-dialog.md)), so export it from there:
  `export { formDialog } from './form-dialog.js';` + `export type { FormDialogOptions } from './form-dialog.js';`.

### `surface.impl.test.ts` edit

`surface.impl.test.ts:16-20` locks the runtime surface to **exactly 5** values. Adding `formDialog`
makes it **6**. Update:
- The assertion list `['FormFieldError', 'bindCheck', 'bindField', 'bindRadio', 'createForm']` → add
  `'formDialog'` (6 entries).
- The prose ("exactly five runtime values", `:4`) → "exactly six runtime values" and name `formDialog`.

`submitting()` is a **type-only** `Form` method — it adds **no** runtime key to the barrel, so the surface
lock's runtime-key assertion is unaffected by it (only `formDialog` moves the count). This is a
deliberate surface change (RD-08 AC #1), asserted by the updated lock — treat `surface.impl.test.ts` as
the impl-level regression guard, not a spec oracle.

## What does NOT change

- `CreateFormOptions` (`types.ts:128-151`) — unchanged (RD-08 §Technical).
- `submit()`'s signature, its `Promise<boolean>` contract, and all four gate return values — unchanged;
  `submitting()` only observes them.
- No new dependency; `zod` stays the only peer dep; `@jsvision/core`/`@jsvision/ui` stay zero-dep.
