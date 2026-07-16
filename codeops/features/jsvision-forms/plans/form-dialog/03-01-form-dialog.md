# 03-01 — `formDialog()` + the `FormDialog` subclass

> **Module**: `packages/forms/src/form-dialog.ts` (NEW — AR-PL1) · **Owning RD**: RD-08 §Technical
>   "Orchestration — the OK-interception dialog" · **Register**: AR-54…61, AR-PL1, AR-PL7.

This is the plan's core. It specifies the new module's two exports of substance — the public
`formDialog` factory and the internal `FormDialog` subclass — grounded in [02-current-state.md](02-current-state.md).
`submitting()` (the store change the gate depends on) is [03-02](03-02-submitting.md); the story is
[03-03](03-03-story.md). Test oracles: [07](07-testing-strategy.md).

## The load-bearing seam (why this shape)

`Dialog.valid(command)` is **synchronous** and is called synchronously inside `handleTerminating`
(`dialog.ts:164,222`) — no `await` in the terminating path. `form.submit()` is **async**
(`create-form.ts:213`, it force-runs async validators). Therefore "`submit()` supersedes `valid()`"
**cannot** be a `valid()` override — the modal loop would never await it (RD-08 §"load-bearing design
fact", AR-56). Resolution: a `Dialog` subclass **intercepts** the `ok` command, `await`s `submit()`
out-of-band, and drives `endModal` **itself** on success, while the dialog is **sealed** for the gate's
duration. A subclass (not a wired-`onClick` OK button) is chosen so a `Commands.ok` from **any** source
— Enter on the default button, a click, `loop.emitCommand(Commands.ok)` in tests — reaches the gate
uniformly (RD-08 §Orchestration).

## Public surface

Exported from `form-dialog.ts` and re-exported by the barrel (AR-PL3, [03-02](03-02-submitting.md)):

```ts
export interface FormDialogOptions<S extends z.ZodObject<z.ZodRawShape>, I> {
  schema: S;
  initial: I;
  asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };
  asyncDebounceMs?: number;
  title?: string;
  body: (form: Form<S, I>) => View;                              // caller binds widgets to form.field(...)
  onSubmit?: (values: z.output<S>) => void | Promise<void>;      // runs inside the gate; reject → stays open
  okText?: string;                                               // default '~O~K'
  width: number;                                                 // REQUIRED — the body is opaque
  height: number;                                                // REQUIRED — Dialog applies a rect only if BOTH given
}

export function formDialog<
  S extends z.ZodObject<z.ZodRawShape>,
  I extends Record<keyof z.output<S>, unknown>,
>(host: ModalDialogHost, options: FormDialogOptions<S, I>): Promise<z.output<S> | null>;
```

- **Types imported, not redeclared**: `ModalDialogHost` from `@jsvision/ui` (`message-box.ts:22`, RD-08
  §Technical); `View`, `Button`, `Dialog`, `Commands`, `cancelButton` from `@jsvision/ui`; `Form`,
  `AsyncValidator` from `./types.js`; `createForm` from `./create-form.js`; `z` type-only from `zod`.
- `width`/`height` are **required** because `Dialog` applies a placement rect only when both are given
  (`dialog.ts:102-109`) and the body is opaque to the helper (RD-08 §Technical, AR-60).
- The generic bound `I extends Record<keyof z.output<S>, unknown>` matches `createForm`'s bound
  (`create-form.ts:91`) so the form types flow through unchanged.

## `FormDialog` subclass (internal — AR-PL7)

`class FormDialog extends Dialog`, holding a reference to the created `form` and the resolved `onSubmit`.
It overrides exactly three members ([02](02-current-state.md) has each base signature):

### 1. `handleTerminating(command, ev)` — the interceptor

Overrides `dialog.ts:219`. Behavior by command:

- **`Commands.ok`**: do **not** call `super`. Instead:
  - If `form.submitting()` is already `true` → **return** (sealed: drop a re-fired OK; RD-08 AC #8).
  - Else set `ev.handled = true` and launch the **async OK gate** (below) — fire-and-forget from this
    sync event turn (the gate is an `async` IIFE / method call whose promise the turn does not await).
- **`Commands.cancel`** (and `yes`/`no`, which this dialog never mounts but the base's `TERMINATING`
  set includes): if `form.submitting()` is `true` → **return** (sealed: Cancel inert during the gate).
  Else `super.handleTerminating(command, ev)` — the inherited cancel path (`valid('cancel')===true` →
  `endModal('cancel')`).

### 2. `resolveCancel(ev)` — seal Esc / close-box

Overrides `dialog.ts:233`. If `form.submitting()` is `true` → **return** (do nothing: Esc and the frame
close-box are inert during the gate). Else `super.resolveCancel(ev)` (RD-08 FR "sealed", AC #8).

### 3. `valid(command)` — the quit-veto (NOT the OK gate)

Overrides `dialog.ts:164`:

```ts
override valid(command: string): boolean {
  if (this.form.submitting()) return false;                        // sealed → veto app-quit
  return command === Commands.cancel || this.form.isValid();       // optimistic sync veto
}
```

This is consulted by `cascadeQuit` (`event-loop.ts:332-336`) on an app-quit, **not** on the OK path (the
OK path is intercepted before `valid()` runs). Limitation, documented in JSDoc + RD-08 FR: the quit veto
is **optimistic/sync** — it cannot force-run async validators (the loop offers only a sync veto hook).

### The async OK gate

Runs off the sync event turn (launched by the `ok` branch above). The dialog is already sealed for its
duration because `form.submitting()` flips `true` synchronously at `submit()` entry ([03-02](03-02-submitting.md))
and every seal check above reads it:

```ts
private async runOkGate(): Promise<void> {
  try {
    const ok = await this.form.submit((values) => {
      this.captured = values;                 // stash the coerced values for the factory
      return this.onSubmit?.(values);         // optional in-modal save, INSIDE the gate
    });
    if (ok) this.modalHost?.endModal(Commands.ok);   // success → end the modal ourselves
    // ok === false → do nothing; the dialog stays open, errors already revealed (create-form.ts:214-217)
  } catch {
    // onSubmit rejected → submit() re-throws (create-form.ts:228 has no try/catch). Stay open.
    // submit()'s own submitting() finally already cleared the flag, so the seal lifts + OK re-enables.
    // formDialog mints NO error UI — the app surfaces failure via its body (AR-58).
  }
}
```

- **`this.captured`** (a `private captured: z.output<S> | null = null` field) is set inside the
  `onValid` closure — captured **before** the factory disposes the form (RD-08 FR, AC #2).
- **Seal correctness** (RD-08 §Orchestration step 1, PF-301): because Cancel/Esc/quit are all inert
  while `submitting()`, no concurrent close can pop the modal or dispose the form during the `await` — so
  `this.modalHost` after the `await` is guaranteed still the active host. The override never calls `super`
  for `ok`, so the base's post-`endModal` host-nulling (`dialog.ts:225`) does not run on this path; there
  is no stale-ref hazard.
- **`endModal` once**: only `ok === true` calls it, exactly once; `false` and the `catch` do not.

## The factory

Mirrors `openFile` (`openers.ts:60-79`, [02](02-current-state.md)), adding form creation + disposal +
value capture:

```ts
export function formDialog(host, options): Promise<z.output<S> | null> {
  const form = createForm({
    schema: options.schema, initial: options.initial,
    asyncValidators: options.asyncValidators, asyncDebounceMs: options.asyncDebounceMs,
  });
  const dlg = new FormDialog({ title: options.title, width: options.width, height: options.height },
                             form, options.onSubmit);
  const ok = new Button(options.okText ?? '~O~K',
                        { command: Commands.ok, default: true, disabled: () => form.submitting() });
  dlg.add(options.body(form));      // caller-built body; binds widgets to form.field(...)
  dlg.add(placed(ok));              // + a placed cancelButton() — absolute rects per the message-box helpers
  dlg.add(placed(cancelButton()));
  host.desktop.addWindow(dlg);
  return (async () => {
    try {
      const command = await host.loop.execView<string>(dlg);
      return command === Commands.ok ? dlg.captured : null;    // captured (coerced) on OK, null otherwise
    } finally {
      host.desktop.removeWindow(dlg);
      form.dispose();                                           // dispose on EVERY path (OK/cancel/throw)
    }
  })();
}
```

- **Button placement**: OK is `default: true` (Enter activates it → drives the same async gate as a fired
  `Commands.ok`, RD-08 AC #11). Both buttons get absolute rects via a small local `placed()` helper (the
  `at()` pattern from `message-box.ts:57-60`); exact rect math is an implementation detail sized to
  `width`/`height`, not a spec oracle. Focusing the first focusable body view (RD-08 FR) is done after
  `addWindow` via the standard focus path.
- **Disposal on every path** (RD-08 AC #10): `form.dispose()` sits in the `finally` beside
  `removeWindow` — OK, cancel, and an exceptional `execView`/body throw all dispose exactly once. The form
  scope is independent of the view scope (`create-form.ts:97`), so both must be town down explicitly.
- **Result** (RD-08 AC #2/#5): `command === Commands.ok ? dlg.captured : null`. On OK the modal was ended
  by the gate with `Commands.ok` and `captured` holds the coerced values; every other terminator (cancel,
  Esc→cancel, close-box→cancel, a quit-close where `'quit' !== 'ok'`) yields `null`.

## JSDoc + `@example` (RD-08 AC #14; CLAUDE.md documentation directive)

`formDialog`, `FormDialogOptions`, and `Form.submitting()` are public/exported → each carries a
class/function-level `@example`. The `formDialog` `@example` shows open → edit → OK-with-values / Cancel-
null (the [00-index](00-index.md) usage block is the model). **Banned in shipped code**: no `RD-`/`AR-`/
`codeops/` refs, no TV/C++ provenance — restate rationale in plain language (verified by grep, AR-PL6).
The `@example` must be copy-pasteable and correct (agent-facing).

## Size budget

`form-dialog.ts` is estimated ~120–160 ln (factory + subclass + options interface + JSDoc/examples) —
well under the 200–500 target and the ~700 split line. No file-size oracle is needed (unlike RD-07's
in-`create-form.ts` growth); [07](07-testing-strategy.md) adds none.
