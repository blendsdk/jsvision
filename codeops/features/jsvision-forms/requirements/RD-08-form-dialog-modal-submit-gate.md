# RD-08: formDialog() + Modal Submit-Gate

> **Document**: RD-08-form-dialog-modal-submit-gate.md
> **Status**: Draft
> **Created**: 2026-07-16
> **Project**: jsvision Forms
> **Depends On**: RD-01 (Form & Field Store — `submit`/`reset`/`field`), RD-02 (Validation & Error
>   Surfacing), RD-06 (Async Validation — the async-aware `submit()` this dialog gates on; `submitting()`
>   extends `submit()`). Package-level: `@jsvision/ui`'s `Dialog` / `execView` / `Button` / `Commands`
>   modal machinery (already a dependency of `@jsvision/forms`). **Soft integrations** (not engine
>   dependencies): RD-07's `loading()` (a caller may show it in the body; load-before-show is out of
>   scope, AR-59) and RD-09's styled `Text` (error display inside the caller-built body).
> **CodeOps Skills Version**: 3.8.0

---

## Feature Overview

Add a **`formDialog()` helper** to `@jsvision/forms` — the first bridge between a headless `createForm`
store and `@jsvision/ui`'s modal `Dialog`. It mirrors the structure of the existing modal helpers
(`messageBox` / `inputBox` at `packages/ui/src/dialog/message-box.ts:101,158`, and especially the
`openFile` / `changeDir` openers at `packages/files/src/openers.ts:60,99` — the closest analog, which
resolve a command and read a typed payload off the dialog): build a `Dialog`, add a caller-built body +
OK/Cancel buttons, run it modally through the host's `execView`, and tear everything down in a
`finally`. On top of that structure it wires the form's **async-aware `submit()` as the OK gate**.

**The core problem this solves.** Today there is *no* integration of a `createForm` store into a modal
dialog (verified: `packages/examples/recipes/form-dialog.ts` is a raw `Input` + `Dialog.valid()` sweep,
not a `createForm`). A developer who wants "edit this record in a modal" must hand-wire a `Dialog`,
bind each `Input`, remember to `dispose()` the form on close, and reconcile the dialog's **synchronous**
OK gate (`Dialog.valid()`) against the form's **asynchronous** `submit()`. `formDialog()` encapsulates
all of that: it owns the form's lifecycle, gates OK on the real `submit()` (so async validators and an
optional async save actually block the close), and resolves the **coerced values** to the caller.

**The load-bearing design fact — the sync/async gate seam.** `Dialog.valid(command): boolean`
(`packages/ui/src/dialog/dialog.ts:164`) is **synchronous** and is invoked synchronously inside the
event-dispatch tick by `handleTerminating` (`dialog.ts:222`) — there is **no `await`** anywhere in the
terminating path. But `form.submit(onValid): Promise<boolean>` (`packages/forms/src/create-form.ts:213`)
is **asynchronous** — it force-runs and awaits every async validator. So "`submit()` supersedes
`Dialog.valid()`" **cannot** be a `valid()` override; the modal loop would never await it. The
reconciliation (AR-56): `formDialog`'s dialog **intercepts** the `ok` command, `await`s `form.submit()`
out-of-band, and only on `true` drives `modalHost.endModal(Commands.ok)` **itself** — while the
inherited synchronous `valid()` is **repurposed** to `command === cancel || form.isValid()` so the
app-quit veto (`cascadeQuit`, `packages/ui/src/event/event-loop.ts:332`) still works.

**Why the form is owned by the dialog** (AR-54). `formDialog()` creates the form, hands it to a
`body(form)` builder (so the caller binds widgets to `form.field(...)`), and disposes it in the
`finally` alongside `removeWindow`. The two scopes are independent — a `createForm` scope is **not** the
dialog view's scope (`create-form.ts:97`), so removing the window does **not** dispose the form; the
helper must dispose both. Owning the form is what lets `formDialog()` return the coerced values (a caller
cannot read a disposed form) and removes the per-dialog-form leak the `createForm` docs warn about
(`create-form.ts:35-36`).

---

## Functional Requirements

### Must Have

- [ ] **`formDialog(host, options)` helper.** A new exported function in `@jsvision/forms`:
      `formDialog<S, I>(host: ModalDialogHost, options: FormDialogOptions<S, I>): Promise<z.output<S> | null>`.
      It **creates** a `createForm` store from `options.schema` / `options.initial` (+ optional
      `asyncValidators` / `asyncDebounceMs`), builds a `Dialog` sized to fit, mounts the caller's
      `options.body(form)` and an OK/Cancel button pair, runs it modally via `host.loop.execView`, and —
      in a `finally` — `removeWindow`s the dialog **and** calls `form.dispose()`. `host` is the existing
      `ModalDialogHost` seam (`message-box.ts:22`: `{ loop: { execView }, desktop: { addWindow,
      removeWindow } }`) that an `Application` satisfies directly (AR-54).
- [ ] **OK gates on the async `submit()` (out-of-band), not the sync `valid()` sweep.** Activating OK
      (or pressing Enter on the default OK button) makes the dialog **intercept** the `ok` command and
      run `const ok = await form.submit(options.onSubmit ?? (() => {}))`. On `ok === true` the dialog
      resolves the modal with the coerced values; on `false` it **stays open** (the failed `submit()`
      has already marked every field `touched` and surfaced the errors — `create-form.ts:214-216`). The
      OK path does **not** run `Dialog.valid()`'s child-sweep (AR-56).
- [ ] **Cancel / Esc / close-box always close, returning `null`.** The Cancel button carries
      `Commands.cancel` and closes through the inherited path (`valid()` returns `true` for cancel,
      `dialog.ts:165`); Esc and the frame close-box route to the same cancel (`dialog.ts:233`). In every
      case `formDialog` resolves `null` — no validation, no save (AR-55).
- [ ] **Result is the coerced values or `null`.** `formDialog` resolves `Promise<z.output<S> | null>`:
      the schema-coerced `values()` (captured inside the `submit` gate) on OK, `null` on cancel / Esc /
      close-box / a quit-close. Because the form is disposed on close, the values are captured **before**
      disposal (AR-55).
- [ ] **Optional in-modal `onSubmit(values)` save.** `options.onSubmit?: (values: z.output<S>) => void |
      Promise<void>` runs as `submit`'s `onValid` — **inside** the gate — so an async save blocks the
      close and is covered by `submitting()`. If `onSubmit` **rejects** (the save failed), the dialog
      **stays open** and OK re-enables; `formDialog` mints **no** error UI — the app surfaces the failure
      through its own body widget bound to app state. If `onSubmit` is omitted, OK validates and collects
      only (resolves the values; the caller saves after close) (AR-58).
- [ ] **`form.submitting()` signal.** `Form` gains `submitting(): boolean` — `true` from the moment
      `submit()` begins until it settles (validators **and** `onValid`/`onSubmit`), `false` on every
      return path. It is form-level, independent of `isValid()`/`loading()`/`validating()`, and completes
      the in-flight-state trio. `formDialog` binds the OK button `disabled: () => form.submitting()` and
      the interceptor **guards re-entrancy** (an `ok` while `submitting()` is ignored) so Enter or a
      double-click cannot double-submit (AR-57, AR-60). This resolves RD-07's AR-45 deferral.
- [ ] **App-quit veto uses the synchronous `form.isValid()`.** The inherited `valid(command)` is
      overridden to `command === Commands.cancel || form.isValid()` so the quit cascade
      (`event-loop.ts:332`, which calls `valid()` **synchronously**) vetoes a quit while the form is
      sync-invalid. This is optimistic and **cannot** force-run async validators (the modal loop offers
      only a synchronous veto hook) — a documented, accepted limitation (AR-56).
- [ ] **Owns and disposes the form.** The form created by `formDialog` is disposed in the same `finally`
      that removes the dialog window — on OK, cancel, and any exceptional close — so no async-validation
      effect or in-flight load survives the dialog (AR-54). This is the encapsulation that removes the
      "remember to `dispose()` your per-dialog form" footgun.
- [ ] **Kitchen-sink dialog story + smoke.** A new kitchen-sink story demonstrates opening a
      `formDialog`, an invalid OK that keeps it open with revealed errors, a valid OK that closes and
      echoes the returned values, and Cancel that returns `null`. It passes the headless smoke test
      (AR-61).

### Should Have

- [ ] `options.okText?: string` overrides the OK button label (default `~O~K`); Cancel is fixed
      (`~C~ancel`). Keeps the common case zero-config while allowing "Save" / "Create" labels (AR-60).
- [ ] `submitting()` is a cheap repeated read (a plain signal), so a body can bind a busy indicator or
      disable inputs during the async gate without recomputation concerns.

### Won't Have (Out of Scope)

- **Load-before-show inside `formDialog`** — no `load:` loader that shows a "Loading…" body before the
  form. Open-to-edit is composed by the caller: `await form.load(...)` (RD-07) before calling
  `formDialog`, or a body that reads `form.loading()`. Deferred to keep RD-08 the submit-gate bridge
  (AR-59). If a load-in-dialog need lands, it is an additive option, not a change to this contract.
- **A minted error UI for a failed `onSubmit`** — `formDialog` keeps the dialog open on an `onSubmit`
  rejection but paints no error itself; the app owns failure display (AR-58).
- **Configurable button sets beyond OK/Cancel** (Yes/No, three-button, custom command wiring) — RD-08 is
  OK + Cancel only. A richer button model is a later, separate concern (AR-60).
- **Cancel-with-unsaved-changes confirmation** — Cancel always closes immediately, returning `null`; a
  "discard changes?" guard is the app's to wrap (it can check `form.dirty()` before calling, or nest a
  `confirm()`); the engine adds no dirty-gate (AR-60).
- **A non-modal / modeless form window** — `formDialog` is modal (goes through `execView`); a modeless
  docked form panel is out of scope.
- **Multi-step / wizard dialogs** — a single form, single OK gate. The wizard reference app already
  covers multi-step flows via the screen router; `formDialog` does not subsume it.

---

## Technical Requirements

### New public surface (`@jsvision/forms`)

```ts
// The modal host — the existing seam an Application satisfies (message-box.ts:22).
interface ModalDialogHost {
  loop: { execView<R>(view: View): Promise<R> };
  desktop: { addWindow(w: View): void; removeWindow(w: View): void };
}

interface FormDialogOptions<S extends z.ZodObject<z.ZodRawShape>, I> {
  schema: S;
  initial: I;
  asyncValidators?: { [K in keyof I]?: AsyncValidator<I[K]> };
  asyncDebounceMs?: number;
  title?: string;
  /** Build the dialog body; bind widgets to `form.field(...)`. The form is owned by the dialog. */
  body: (form: Form<S, I>) => View;
  /** Optional in-modal save; runs inside the submit gate. Reject → dialog stays open. */
  onSubmit?: (values: z.output<S>) => void | Promise<void>;
  okText?: string;   // default '~O~K'
  width?: number;    // optional geometry overrides (mirrors DialogOptions)
  height?: number;
}

function formDialog<S extends z.ZodObject<z.ZodRawShape>, I extends Record<keyof z.output<S>, unknown>>(
  host: ModalDialogHost,
  options: FormDialogOptions<S, I>,
): Promise<z.output<S> | null>;

// Additive to the existing Form interface:
interface Form<S, I> {
  // …existing: field, values, rawValues, errors, isValid, dirty, validating, loading, load, submit, reset, dispose
  submitting(): boolean;   // NEW — a submit() is in flight
}
```

`formDialog` is a **new barrel export**; `submitting` is a new `Form` method (type-only surface change
plus the runtime field). `CreateFormOptions` is unchanged.

### Orchestration — the OK-interception dialog (internal)

Grounded in the modal machinery (`dialog.ts`, `event-loop.ts`, `message-box.ts`, `openers.ts`):

- **A `Dialog` subclass** (internal to `formDialog`) intercepts the terminating path. The base
  `Dialog.onEvent` → `handleTerminating` (`dialog.ts:189,219`) runs `valid()` synchronously and calls
  `endModal` in the same tick. The subclass overrides the `ok` branch: instead of the sync sweep it
  runs the async gate. A subclass (not a wired-`onClick` button) is chosen so a fired `Commands.ok`
  from **any** source — Enter on the default button, a mouse click, `loop.emitCommand(Commands.ok)` in
  tests — reaches the gate uniformly.
- **The async OK gate** (fire-and-forget from the sync event turn):
  1. If `form.submitting()` is already `true`, ignore (re-entrancy guard).
  2. Capture the `modalHost` reference locally — the base `handleTerminating` nulls `this.modalHost`
     after `endModal` (`dialog.ts:224`); the async override must hold its own reference across the
     `await` so a late resolve can still end the modal.
  3. `let captured: z.output<S> | null = null;`
     `const ok = await form.submit((values) => { captured = values; return options.onSubmit?.(values); });`
  4. On `ok === true`: `host.endModal(Commands.ok)` and stash `captured` for the outer factory to
     resolve. On `false` (sync/async validation failed) **or** an `onSubmit` rejection propagated
     through `submit()`: do nothing — the dialog stays open, errors are already revealed
     (`create-form.ts:214`), and `submitting()` has returned to `false` so OK re-enables.
- **The synchronous `valid()` override**: `valid(command) => command === Commands.cancel ||
  form.isValid()` — keeps the app-quit veto (`cascadeQuit`, `event-loop.ts:335`) coherent without
  touching the loop. It is **not** the OK gate (that is the async interceptor above).
- **Buttons**: `okCancelButtons()` (`buttons.ts:88`) gives an OK (`default: true`, Enter) + Cancel pair
  with the `Commands.ok`/`Commands.cancel` wiring already correct; `okText` overrides the OK label. OK
  is `disabled: () => form.submitting()`.
- **The outer factory** mirrors `openFile` (`openers.ts:60-79`): `host.desktop.addWindow(dlg)`, then
  `try { const command = await host.loop.execView<string>(dlg); return command === Commands.ok ?
  captured : null; } finally { host.desktop.removeWindow(dlg); form.dispose(); }`.

### `submitting()` orchestration (internal — additive to `create-form.ts`)

- One form-level `submitting = signal(false)`, seeded beside `loading`/`submitAttempted`
  (`create-form.ts:110-118`).
- `submit()` (`create-form.ts:213`) sets `submitting.set(true)` at entry (inside/after the initial
  `batch`) and `submitting.set(false)` on **every** return path — the sync-invalid short-circuit, the
  async-invalid return, the `coerced === null` guard, and the success path after `onValid` settles —
  including if `onValid`/`onSubmit` throws (a `try/finally` around the awaited section, so a rejecting
  `onSubmit` clears `submitting()` before the rejection propagates). Exposed as `submitting: () =>
  submitting()` on the returned object.
- No change to `submit()`'s gate semantics or its `Promise<boolean>` contract; `submitting()` is a pure
  observation of the existing lifecycle.

### Reactive-core & layering constraints

- `formDialog` lives in `@jsvision/forms` (which already imports `@jsvision/ui`); `@jsvision/ui` cannot
  depend on `@jsvision/forms`, so this is the only valid placement. It composes over the **public**
  `Dialog` / `execView` / `Button` / `Commands` seams — no `@jsvision/ui` change is required (verified:
  the modal-host handle is injected into any `ModalHostAware` view by `execView`, `event-loop.ts:359`).
- `@jsvision/forms` keeps `zod` as its only peer dependency; `@jsvision/core` / `@jsvision/ui` stay zero
  runtime deps. `formDialog` adds no new dependency.
- The store stays headless and performs no I/O; every network call lives inside the author's `onSubmit`
  (or a pre-`formDialog` `form.load`). `formDialog` draws only the standard `Dialog` chrome + the
  caller's body.

---

## Integration Points

### With RD-01 (the store it wraps)
Additive: `formDialog` consumes the public `createForm` / `field` / `submit` / `dispose` surface and
adds one `Form` method (`submitting()`). A form used outside a dialog is unaffected — `submitting()` is
a new observation, no existing accessor changes.

### With RD-06 (async validation)
`formDialog`'s OK gate **is** RD-06's async-aware `submit()`: the async validators force-run and gate
the close (`create-form.ts:223-224`), so a value an async rule rejects keeps the dialog open. `submit()`
gains `submitting()`; on dialog close, `form.dispose()` tears down RD-06's standing async effects
(`create-form.ts:97`).

### With RD-07 (async loading)
Soft: `dispose()` on dialog close also aborts any in-flight `load()` (RD-07's root-body `onCleanup`,
`create-form.ts:136`). A caller composes open-to-edit by `await form.load(...)` before `formDialog`, or a
body that reads `form.loading()` — but **load-before-show is not built into `formDialog`** (AR-59). This
corrects RD-07's forward reference: the dialog does not own the load; it disposes it.

### With RD-09 (styled error text)
Soft/UI: the caller's `body(form)` typically uses RD-09's `Text` `severity` to paint field errors
(touched-gated) and `Input` `placeholder`s. `formDialog` mandates none of this — the body is
caller-built — but the story and `@example` use them.

### With RD-05 (Comprehensive Showcase, built last)
The showcase curates a `formDialog` story alongside the store / async / load stories — an "edit in a
modal" flow with the submit-gate, the `submitting()` busy state, and a returned-values echo.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Placement + form ownership | (a) in `@jsvision/forms`, dialog owns+disposes the form · (b) in `@jsvision/ui` taking a `Form` · (c) caller passes a pre-built form | **(a) in `@jsvision/forms`; `formDialog` creates, owns, and disposes the form; `body(form)` builder** | `ui` can't import `createForm` (layering); owning the form lets it return coerced values and removes the per-dialog-form leak (`create-form.ts:35`). | AR-54 |
| Signature + result shape | (a) `Promise<z.output<S> \| null>` (values/​null) · (b) `Promise<'ok'\|'cancel'>` (bare command) | **(a) coerced values on OK, `null` on cancel/Esc/close** | The form is disposed on close, so the caller can't read it after — the helper must return the values; mirrors `openFile`'s `dlg.result()` payload model (`openers.ts:75`). | AR-55 |
| OK gate mechanism | (a) intercept `ok` → `await submit()` → drive `endModal`; sync `valid()`→`isValid()` for quit-veto · (b) native sync `valid()` child-sweep as the OK gate | **(a) async `submit()` drives close; sync `valid()` repurposed to `isValid()`** | `Dialog.valid()` is sync + un-awaited (`dialog.ts:164,222`); `submit()` is async (`create-form.ts:213`) — only (a) lets async validators + save gate OK. (b) would bypass `submit()` entirely, defeating RD-06. | AR-56 |
| `submitting()` signal | add a form-level signal vs a dialog-local flag | **Add `form.submitting()` to `Form`** | Completes the `loading()`/`validating()`/`submitting()` trio; reusable outside a dialog; blocks double-submit; resolves RD-07's AR-45 deferral. | AR-57 |
| Save location | (a) optional in-modal `onSubmit(values)` (save inside the gate; reject → stay open) · (b) collect-and-return only (caller saves after close) | **(a) optional in-modal `onSubmit`; omitted ⇒ validate+collect** | `submit()` awaits `onValid` precisely so a failed save can veto the close; keeping the dialog open on a save failure is the correct "submit-gate" UX. No minted error UI — app owns failure display. | AR-58 |
| Load-before-show | build a `load:` loader + "Loading…" body vs caller-composed | **Out of scope; caller composes `load` (RD-07) or reads `loading()`** | Keeps RD-08 the submit-gate bridge; avoids importing the load lifecycle + its failure path into the dialog. | AR-59 |
| Buttons + double-submit | fixed OK+Cancel vs configurable; guard re-entrancy | **OK+Cancel (optional `okText`); OK `disabled: () => submitting()` + re-entrancy guard** | The common case; `okCancelButtons()` presets already wire the commands (`buttons.ts:88`); the guard makes Enter/double-click safe during the async gate. | AR-60 |
| Repo gates + security | — | **Kitchen-sink `forms/dialog` story + smoke; headless modal test harness; no engine I/O; bound-field render sanitisation** | Story non-negotiable; ACs testable via `createEventLoop` + `emitCommand` (mirroring `openers.impl.test.ts`); engine mints/fetches nothing. | AR-61 |

> **Traceability:** every decision references `00-ambiguity-register.md` (AR-54…AR-61).

---

## Security Considerations

- **Data sensitivity**: `onSubmit` is author-supplied and typically performs the network write (save the
  edited record). The engine passes it only the coerced `values` and holds no credentials/PII; it
  performs no I/O itself.
- **Input validation**: the body binds widgets to `form.field(...)`; any **string** field renders
  through the existing control-byte sanitisation path (`ScreenBuffer.set` / `sanitize`) exactly as
  elsewhere — a value carrying control bytes cannot paint a raw control cell. `formDialog` adds no new
  render path (it uses `Dialog` chrome + the caller's body). The OK gate runs the full schema `safeParse`
  (via `submit()`), so no unvalidated value reaches `onSubmit`.
- **Injection risks**: none introduced — no `eval`/dynamic code; the engine builds no queries/paths.
  Any network call lives inside the author's `onSubmit`, which owns its URL construction and escaping
  (documented in the `@example`).
- **Availability / abuse**: OK is disabled while `submitting()` and the interceptor guards re-entrancy,
  so a stuck async `onSubmit` cannot be re-triggered into overlapping saves. Server-side rate-limiting of
  the save endpoint is the app's responsibility (a TUI-client concern out of the library's control).
- **Lifecycle / resource safety**: the form is disposed on **every** close path (OK, cancel, exception)
  in the `finally`, tearing down async-validation effects and any in-flight load — no post-close effect
  or timer survives. The modal stack is not popped until the async gate resolves, so input stays confined
  to the dialog during the validation/save window.
- **Authentication & authorization / encryption / infrastructure**: N/A — an in-process reactive modal
  orchestrator with no endpoints or persistence of its own.

---

## Acceptance Criteria

1. [ ] **Barrel + surface.** `@jsvision/forms` exports `formDialog`; `Form` gains `submitting(): boolean`.
       A form that never enters a dialog behaves exactly as RD-06/RD-07 (`submitting()` is `false` at
       rest; every existing accessor unchanged — regression-locked). The surface-lock impl test is
       updated to the new runtime export count.
2. [ ] **Valid OK resolves the coerced values + tears down.** Driven headlessly (a `createEventLoop`
       host per `openers.impl.test.ts`): open a `formDialog` over a valid-fillable schema, make the form
       valid, fire `Commands.ok` → the promise resolves to the **coerced** `z.output<S>` values, the
       dialog is `removeWindow`ed, and `form.dispose()` ran (a later value write drives no effect).
3. [ ] **Invalid OK keeps the dialog open.** With a sync-invalid form, firing `Commands.ok` does **not**
       resolve the promise or remove the dialog; every field is now `touched()` (errors revealed) and
       the dialog remains mounted and modal.
4. [ ] **Async validator gates OK.** For a form whose `asyncValidators` rejects the current value, firing
       `Commands.ok` runs the async gate (`submit()` force-runs the validator), the dialog stays open,
       and `field.asyncError()` is set — proving OK went through the real async `submit()`, not the sync
       `valid()` sweep.
5. [ ] **Cancel / Esc resolve `null` + tear down.** Firing `Commands.cancel` (and, separately, the Esc
       route) resolves the promise to `null`, removes the dialog, and disposes the form — with no
       validation and no `onSubmit` call.
6. [ ] **In-modal `onSubmit` runs inside the gate.** With an `onSubmit` that awaits, `submitting()` is
       `true` across the await; on resolve the dialog closes and the promise yields the values; `onSubmit`
       was called exactly once with the coerced values.
7. [ ] **`onSubmit` rejection keeps the dialog open.** An `onSubmit` that rejects leaves the dialog open,
       `submitting()` returns to `false` (OK re-enabled), the promise is **not** resolved, and no
       partial/`null` result leaks; a subsequent successful OK still resolves the values.
8. [ ] **`submitting()` transitions + double-submit guard.** `submitting()` is `false` before, `true`
       across the async gate, `false` after; a second `Commands.ok` fired while `submitting()` is `true`
       is ignored (the interceptor's re-entrancy guard) — `onSubmit`/`submit` runs once.
9. [ ] **Quit-veto uses sync `isValid()`.** While the dialog is open with a sync-invalid form, the app
       quit cascade's `valid(Commands.quit-terminating)` returns `false` (veto); with a sync-valid form it
       returns `true`. (Documents that quit-veto is optimistic/sync and does not force-run async
       validators.)
10. [ ] **Form owned + disposed once, on every path.** The form `formDialog` created is disposed exactly
        once — on OK, on cancel, and if the body/`onSubmit` throws — in the same `finally` as
        `removeWindow`; opening + closing a dialog emits no unowned-computation warning (the `openers`
        #37-style guard).
11. [ ] **`okText` + default button.** `options.okText` overrides the OK label; OK is the `default`
        button (Enter activates it); Cancel is fixed. Firing Enter on the default button drives the same
        async OK gate as `Commands.ok`.
12. [ ] Kitchen-sink `forms/dialog` story: opens the dialog, shows an invalid-OK-stays-open then
        valid-OK-closes-with-values flow (or a launch button + a values echo in the headless smoke
        degrade), has a unique id + required metadata, and passes `kitchen-sink.smoke.spec.test.ts`.
13. [ ] Security: a **string** field edited/loaded with control bytes — e.g. `'a\x00b\x1b[31mc\x9b'` —
        rendered via a widget bound in the dialog body paints **no** cell with a code point `< 0x20`,
        `=== 0x7f`, or in `0x80–0x9f` (the same render-and-scan oracle RD-04/RD-06/RD-07 use).
14. [ ] `yarn verify` is green; `yarn check:docs` passes — the new `formDialog` and `submitting()` surface
        carries a class/function-level `@example` (open → edit → OK-with-values / Cancel-null), and no
        banned CodeOps/TV references appear in shipped code (verified by a plain grep, not `check:docs`
        alone).
