# Ambiguity Register — form-dialog (RD-08 plan)

> **Zero-Ambiguity Gate for the RD-08 implementation plan.** The *behavioral* design is resolved and
> preflighted in the requirements (`../../requirements/RD-08-form-dialog-modal-submit-gate.md`, AR-54…61;
> `../../requirements/00-preflight-report-rd-08.md` — ✅ PASSED, 9 findings applied). This register
> imports those as pre-resolved context and records only the **plan-level** decisions. AR-PL1/PL2 are
> explicit user decisions (2026-07-16, AskUserQuestion); AR-PL3…PL7 are recommendations derived from
> them, from the codebase, and from the RD-06/RD-07 plan precedents, confirmed on review.

## Imported (resolved in the RD, not re-litigated here)

| RD AR | Decision (summary) |
|-------|--------------------|
| AR-54 | `formDialog(host, options)` lives in `@jsvision/forms`, **creates/owns/disposes** the form; `body(form)` builder. |
| AR-55 | `formDialog(host, options): Promise<z.output<S> \| null>` — coerced values on OK, `null` on cancel/Esc/close/quit-close. |
| AR-56 | OK **intercepts** the `ok` command, `await`s `form.submit(onSubmit)` **try/caught**, drives `endModal(ok)` itself on `true`; the dialog is **sealed** while `submitting()` (Cancel/Esc/quit inert, `valid()`→false); sync `valid()`→`isValid()` for the quit-veto. |
| AR-57 | Add `form.submitting(): boolean` (true while `submit()` in flight; try/finally). Resolves RD-07 AR-45. |
| AR-58 | Optional in-modal `onSubmit(values)`; reject → stay open (caught), no minted error UI; omitted → validate+collect. |
| AR-59 | Load-before-show **out of scope** (caller composes RD-07 `load` / reads `loading()`). |
| AR-60 | Fixed OK+Cancel; OK built **directly** (`new Button(...)`, presets can't carry `okText`/`disabled`); OK `disabled: () => submitting()`. |
| AR-61 | Kitchen-sink `forms/dialog` story + smoke; ACs headlessly testable via `createEventLoop`+`emitCommand`; no engine I/O; bound-field render sanitisation. |

## Plan-level decisions (this register)

| AR | Decision | Resolution | Status |
|----|----------|------------|--------|
| AR-PL1 | **Code placement** of `formDialog` | **New module `packages/forms/src/form-dialog.ts`** exporting `formDialog` + `FormDialogOptions`, holding the internal `class FormDialog extends Dialog`. Mirrors `@jsvision/files/src/openers.ts` (`openFile`/`changeDir`). `formDialog` is a standalone `(host, options)` helper that **creates** a form via `createForm` and uses **no** `buildForm` internals, so it has no reason to live in `create-form.ts`; keeping it separate also keeps `@jsvision/ui`'s `Dialog`/`Button`/`Commands` imports out of the store module (which imports only reactive primitives, `create-form.ts:1`). `submitting()` is the **only** `create-form.ts` change. Inline-in-`create-form.ts` was considered and **rejected** (create-form.ts is already ~280 ln; +~100 for the subclass+factory pushes it toward ~400 and couples the store file to the dialog stack). | ✅ Resolved (user) |
| AR-PL2 | **`submitting()` test location** | **In `form-dialog.spec.test.ts`** (the primary consumer): the `submitting()` oracles (ST-D-SUB1…3) are asserted **directly on `form.submit()`** (no dialog needed) alongside the `formDialog` behaviors (ST-D1…). One cohesive spec file for the RD-08 surface. A dedicated `submitting.spec.test.ts` was considered and rejected (a 3-oracle surface doesn't warrant a separate file). | ✅ Resolved (user) |
| AR-PL3 | **Barrel + surface lock** | `index.ts` gains a runtime export `formDialog` and a type export `FormDialogOptions` (`AsyncValidator`-style). `surface.impl.test.ts`'s 5-value lock (`:16-20`) is **updated to 6** (`createForm`, `bindField`, `bindRadio`, `bindCheck`, `FormFieldError`, **`formDialog`**) — a deliberate surface change (RD-08 AC #1). `submitting()` is a type-only `Form` method (no runtime key). | ✅ Resolved (derived) |
| AR-PL4 | **Kitchen-sink story** | New `forms-dialog.story.ts` — `id: 'forms/dialog'`, `category: 'Forms'`, `rd: 'RD-08'` — a launch button that, when `ctx.execView` is present, opens the `formDialog` (edit → invalid-OK-stays-open → valid-OK → values echo); **degrades to the launch button + a values/last-result echo + an always-painted hint when `ctx.execView` is `undefined`** (the headless smoke case, `story.ts:30-33`). Smoke oracle **ST-DS1**. Mirrors `file-dialog.story.ts`/`chdir-dialog.story.ts` (the modal-story pattern). | ✅ Resolved (derived) |
| AR-PL5 | **Test harness + ST prefix** | Headless: `createEventLoop({width,height},{caps})` + a fake `{ loop, desktop:{ addWindow, removeWindow } }` host + `loop.emitCommand(Commands.ok/cancel)` + `loop.dispatch({type:'key',…})`, exactly mirroring `files/test/openers.impl.test.ts:24-60`. Prefix **`ST-D*`** (dialog): `form-dialog.spec.test.ts` (ST-D-SUB1…3 + ST-D1…D10 immutable oracles), `form-dialog.impl.test.ts` (internals/edges), `form-dialog-security.spec.test.ts` (ST-D-SEC, the render-and-scan control-byte oracle). `@jsvision/ui`'s `createEventLoop`/`Commands` are already importable from forms tests (the security specs import `createRenderRoot`). | ✅ Resolved (derived) |
| AR-PL6 | **Verify command** | **`yarn verify`** (root; `lint` → turbo `typecheck build test check:docs`) per phase + final gate, per `CLAUDE.md` — same as RD-06/RD-07. Banned-CodeOps/TV refs checked by a **plain `grep` over `packages/forms/src`** in addition to `check:docs`. No git in the plan (commits via `/gitcm`·`/gitcmp`). | ✅ Resolved (derived) |
| AR-PL7 | **The FormDialog subclass mechanics** | `class FormDialog extends Dialog` overrides **`handleTerminating(command, ev)`** (`protected`, `dialog.ts:219`): for `Commands.ok` it runs the async gate (try/caught `await form.submit`, then `this.modalHost?.endModal(ok)`), for `cancel` it defers to `super` **unless** `submitting()` (sealed → ignore). Overrides **`resolveCancel`** (`dialog.ts:233`) to no-op while `submitting()` (seal Esc/close-box). Overrides **`valid(command)`** → `submitting() ? false : (command === Commands.cancel \|\| form.isValid())`. The factory creates the form, builds the subclass + body + buttons, `addWindow` → `execView` → maps command → `finally { removeWindow; form.dispose() }`. | ✅ Resolved (derived) |

## Gate status — ✅ GATE PASSED (2026-07-16)

- [x] Behavioral design imported from the preflighted RD-08 (AR-54…61) — not re-litigated.
- [x] The pivotal plan fork (AR-PL1 placement) + the test-layout fork (AR-PL2) resolved by explicit user
      decision (AskUserQuestion, 2026-07-16).
- [x] Derived items (AR-PL3…PL7) recorded with codebase-grounded rationale (`file:line`) and RD-06/07-plan
      precedent.
- [x] Zero deferred items — every plan-level ambiguity has a concrete answer.
- [x] Verify command confirmed (`yarn verify`, AR-PL6).
- [x] User reviewed and confirmed the plan-level decisions.
