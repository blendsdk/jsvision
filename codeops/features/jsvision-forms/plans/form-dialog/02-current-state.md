# 02 — Current State

The exact code this plan reads and touches, verified at `file:line` on the `feat/form-remains` branch
(2026-07-16). Every claim here was read from source, not remembered. This is the reality check the
implementation is written against.

## `@jsvision/forms` — the store (`packages/forms/src/create-form.ts`, 280 ln)

`createForm` nests its reactive graph in a `createRoot` scope and returns the object built by
`buildForm` (`create-form.ts:91-98`). The pieces this plan builds on:

- **`submit()` — the async gate the dialog wraps** (`create-form.ts:213-230`). Signature
  `submit(onValid: (values) => void | Promise<void>): Promise<boolean>`. It has **four return paths**:
  1. `batch()` marks every field touched + sets `submitAttempted` (`:214-217`) — so a failed OK reveals
     errors with no extra work by the dialog.
  2. Sync-invalid short-circuit → `return false` (`:221`).
  3. `cancelPendingDebounces()` → `await runAllForced()` → async-invalid → `return false` (`:223-225`).
  4. `coerced === null` guard → `return false` (`:227`), else `await onValid(coerced)` → `return true`
     (`:228-229`).
  - **Load-bearing fact for the OK gate**: `await onValid(coerced)` at `:228` is **not** wrapped in
    try/catch — a throwing/rejecting `onValid` makes `submit()` **re-throw** (not resolve `false`). This
    is why the dialog's OK gate must `try/catch` the `await submit(...)` (RD-08 FR, AR-56; [03-01](03-01-form-dialog.md)).
  - There is **no `submitting`-style in-flight flag today** — `submit()` exposes only its `Promise<boolean>`.
- **The returned object** (`create-form.ts:266-279`) lists exactly: `field`, `values`, `rawValues`,
  `errors`, `isValid`, `dirty`, `validating`, `loading`, `load`, `submit`, `reset`, `dispose`. **No
  `submitting` key** — this plan adds it ([03-02](03-02-submitting.md)).
- **Signal seeding sites** the new signal sits beside: `submitAttempted = signal(false)` (`:121`),
  `loading = signal(false)` (`:127`).
- **`isValid` / `dispose`**: `isValidForm()` is the sync `validation.isValid() && asyncLayer.allAsyncClean()`
  (`:201`); `dispose: disposeScope` is the idempotent root disposer (`:278`). The dialog's `valid()`
  override reads `form.isValid()`, and the factory `finally` calls `form.dispose()`.
- **Scope independence**: a `createForm` scope is nested under the active owner (`:97`), **not** the
  dialog view's scope — so `removeWindow(dlg)` does not dispose the form; the factory must dispose it
  explicitly (RD-08 §"Why the form is owned by the dialog", AR-54).

## `@jsvision/forms` — the type surface (`packages/forms/src/types.ts`)

- `interface Form<S, I>` (`types.ts:59-119`) declares the accessors; **no `submitting()` yet** — the plan
  adds one method between `loading()`/`load()` (`:84-99`) and `submit()` (`:100-109`). `submit`'s JSDoc is
  at `:100-109`.
- `AsyncValidator<T>` (`types.ts:18`) is exported — the `asyncValidators` option's element type; the
  `FormDialogOptions.asyncValidators` field reuses it.

## `@jsvision/forms` — the barrel + surface lock

- `packages/forms/src/index.ts` (5 lines) exports 5 runtime values (`createForm`, `bindField`,
  `bindRadio`, `bindCheck`, `FormFieldError`) + 4 type-only (`Form`, `Field`, `CreateFormOptions`,
  `AsyncValidator`). The plan adds a runtime `formDialog` + a type `FormDialogOptions` (AR-PL3).
- `packages/forms/test/surface.impl.test.ts:16-20` asserts `Object.keys(forms).sort()` **equals exactly
  the 5-value list**. Adding `formDialog` makes this **6**; the test's list + its prose ("exactly five
  runtime values") must update to 6 (AR-PL3). `submitting()` is a type-only `Form` method — **no** new
  runtime key, so it does not affect this lock.

## `@jsvision/ui` — the modal machinery this composes over (unchanged)

- **`ModalDialogHost`** (`packages/ui/src/dialog/message-box.ts:22-27`): `{ loop: Pick<EventLoop,
  'execView'>; desktop: Pick<Desktop, 'addWindow' | 'removeWindow' | 'bounds'> }`. Barrel-exported from
  `@jsvision/ui`. `formDialog` **imports** this type (does not redeclare it) — an `Application` satisfies
  it directly (RD-08 §Technical).
- **`Dialog`** (`packages/ui/src/dialog/dialog.ts`): the subclass base.
  - `valid(command): boolean` (`:164-168`) — **synchronous**: `cancel` → `true`; else a child `valid()`
    sweep. The plan **overrides** this (AR-PL7).
  - `onEvent` (`:189-216`) routes a `TERMINATING` command → `handleTerminating` (`:192-195`), Esc →
    `resolveCancel` (`:199-201`), close-box → `resolveCancel` (`:205-212`).
  - `handleTerminating(command, ev)` (`protected`, `:219-230`) — runs `valid()` **synchronously** and
    `this.modalHost.endModal(command)` in the same tick (`:222-223`), then **nulls `modalHost`** (`:225`).
    The plan **overrides** this to intercept `Commands.ok` with the async gate (AR-PL7). Note `:221`:
    a disabled command is ignored (`isCommandEnabled`).
  - `resolveCancel(ev)` (`protected`, `:233-240`) — ends the modal as `cancel`, nulls `modalHost`. The
    plan **overrides** this to no-op while `submitting()` (seal Esc/close-box; AR-PL7).
  - `protected modalHost: ModalHost | null` (`:83`) — the host handle `execView` injects
    (`attachModalHost`, `:134-136`); the override reads `this.modalHost?.endModal(...)`.
- **`execView`** injects the modal host into any `ModalHostAware` view (`event-loop.ts:359`) and
  resolves to the terminating command string. `cascadeQuit` calls the top view's `valid(quitCommand)`
  synchronously (`event-loop.ts:332-336`) — the quit-veto seam the `valid()` override serves.
- **`Button`** (`packages/ui/src/dialog/button.ts` / `buttons.ts`): `okButton()`/`okCancelButtons()`
  hardcode `'~O~K'` and pass no `disabled`; `Button`'s label/command/disabled are constructor-only
  (`button.ts:57-83`), but the constructor accepts a **reactive `disabled` getter** (`button.ts:28`).
  So the OK button is built **directly**: `new Button(okText ?? '~O~K', { command: Commands.ok, default:
  true, disabled: () => form.submitting() })`; Cancel from `cancelButton()` (AR-60, RD-08 §Orchestration).
- **The factory precedent**: `openFile` (`packages/files/src/openers.ts:60-79`) is the closest analog —
  `desktop.addWindow(dlg)` → `try { const command = await loop.execView<string>(dlg); return command ===
  Commands.ok ? dlg.result() : null } finally { desktop.removeWindow(dlg) }`. `formDialog` mirrors it,
  adding `form.dispose()` to the `finally` and capturing the coerced values in the gate (RD-08 §Orchestration).

## `@jsvision/examples` — the story surface

- `packages/examples/kitchen-sink/story.ts`: `StoryContext.execView?: (modal: View) => Promise<unknown>`
  is **`undefined` in the headless smoke test** (`story.ts:33`); `Story` requires `id`/`category`/`title`
  /`blurb`/`build`, optional `rd` (`:37-47`). The modal-story pattern (`file-dialog.story.ts:31-44`)
  guards `if (ctx.execView === undefined)` and degrades to a launch button + echo — the plan's story
  mirrors it (AR-PL4).
- Registration is two lines in `stories/index.ts` (import + array entry) next to `formsLoadStory`
  (`index.ts:55,106`). Smoke oracle: `packages/examples/test/kitchen-sink.smoke.spec.test.ts`.
- **Build-order gotcha**: examples import `@jsvision/forms` **by name → dist**, so `formDialog` must be
  built before the examples typecheck/tests run (turbo's `test dependsOn build` handles it under
  `yarn verify`; a bare per-package run needs a forms build first).

## Test harness precedent

`packages/files/test/openers.impl.test.ts:24-60` builds a headless host: `createEventLoop({width,height},
{caps})` + a fake `{ loop, desktop: { addWindow, removeWindow } }` + `loop.emitCommand(Commands.ok/cancel)`
+ `loop.dispatch({type:'key', key:'escape'})`. The `ST-D*` tests reuse this exact shape (AR-PL5). The
forms security specs already import `createRenderRoot` from `@jsvision/ui`, so `createEventLoop`/`Commands`
are importable from forms tests.
