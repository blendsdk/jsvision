# formDialog() + Modal Submit-Gate — Implementation Plan

> **Feature**: A `formDialog()` helper for `@jsvision/forms` — the first bridge from a headless
>   `createForm` store into a modal `@jsvision/ui` `Dialog`. The dialog **creates/owns/disposes** the
>   form; **OK gates on the async `form.submit()`** (intercept the `ok` command → try/caught `await
>   submit()` → drive `endModal` itself), the dialog is **sealed** during the async gate, and it resolves
>   the coerced values (or `null`). Adds a `form.submitting()` signal.
> **Status**: 📋 Plan created (0/18 tasks)
> **Created**: 2026-07-16
> **Implements**: jsvision-forms/RD-08
> **CodeOps Skills Version**: 3.8.0

## Overview

Today there is no way to run a `createForm` store inside a modal dialog: `Dialog.valid()`
(`packages/ui/src/dialog/dialog.ts:164`) is **synchronous** and un-awaited, but `form.submit()`
(`packages/forms/src/create-form.ts:213`) is **asynchronous** (it force-runs async validators), so an OK
button cannot simply gate on `submit()`. A developer must hand-wire the `Dialog`, bind each `Input`,
reconcile the sync/async gate, and remember to `dispose()` the form on close.

This plan adds **`formDialog(host, options): Promise<z.output<S> | null>`** in a new module
`packages/forms/src/form-dialog.ts` (AR-PL1). It creates the form, hands it to a `body(form)` builder,
and runs a `Dialog` subclass whose OK path **intercepts the `ok` command, `await`s `form.submit(onSubmit)`
in a `try/catch`, and drives `this.modalHost?.endModal(Commands.ok)` itself** on success — while the
dialog is **sealed** for the duration of the gate (Cancel/Esc/quit inert, `valid()`→false) so no
concurrent close can pop the modal mid-`await`. The sync `valid()` is repurposed to `form.isValid()` for
the app-quit veto. On close the factory removes the window **and** disposes the form. It also adds
`form.submitting()` to the store (AR-57) — the only `create-form.ts` change.

**Why a new module, not inline?** `formDialog` is a standalone `(host, options)` helper that *consumes*
the public `createForm` surface and uses no `buildForm` internals; it mirrors `@jsvision/files`'s
`openers.ts`. Inlining it would bloat `create-form.ts` (~280 → ~400 ln) and drag `@jsvision/ui`'s
`Dialog`/`Button` imports into the store module (AR-PL1).

The change is confined to `@jsvision/forms` (new `form-dialog.ts`; additive `submitting()` in
`create-form.ts`/`types.ts`; one barrel export) plus **one kitchen-sink story** in `@jsvision/examples`.
No `@jsvision/ui` change — it composes over the public `Dialog`/`execView`/`Button`/`Commands` seams.
`@jsvision/core`/`@jsvision/ui` stay zero-dep; `zod` stays the only peer dep.

## Document Index

| #   | Document                                              | Description                                          |
| --- | ---------------------------------------------------- | ---------------------------------------------------- |
| AR  | [Ambiguity Register](00-ambiguity-register.md)       | Zero-Ambiguity Gate — imported AR-54…61 + plan rows AR-PL1…PL7 |
| 00  | [Index](00-index.md)                                 | This document — overview and navigation              |
| 01  | [Requirements](01-requirements.md)                   | Delta view over RD-08 (the owning requirements doc)  |
| 02  | [Current State](02-current-state.md)                 | The exact code the plan touches (verified `file:line`) |
| 03-01 | [form-dialog orchestration](03-01-form-dialog.md)  | The `formDialog` factory + the `FormDialog` subclass |
| 03-02 | [submitting() signal](03-02-submitting.md)         | The additive `form.submitting()` in `create-form.ts`/`types.ts`/barrel |
| 03-03 | [Kitchen-sink dialog story](03-03-story.md)        | The live "edit in a modal" demo + smoke              |
| 07  | [Testing Strategy](07-testing-strategy.md)           | Spec oracles (ST-D*) — every RD-08 AC maps to ≥1 oracle |
| 99  | [Execution Plan](99-execution-plan.md)               | Phases, tasks, checklist                             |

## Quick Reference

### Usage Example

```ts
import { formDialog } from '@jsvision/forms';
import { Group, Input, Label } from '@jsvision/ui';
import { z } from 'zod';

const schema = z.object({ name: z.string().min(1, 'Required'), port: z.coerce.number().int().min(1) });

const values = await formDialog(app, {
  schema,
  initial: { name: '', port: '8080' },
  title: 'Edit server',
  width: 44,
  height: 9,
  body: (form) => {
    const g = new Group();
    const input = new Input({ value: form.field('name').value });
    g.add(new Label('~N~ame', input));
    g.add(input);
    return g;
  },
  onSubmit: async (v) => { await api.save(v); }, // runs INSIDE the gate; reject → dialog stays open
});
if (values) status.set(`Saved ${values.name}`); // null on Cancel/Esc
```

### Key Decisions

| Decision | Outcome | Ref |
| -------- | ------- | --- |
| Placement | **New module `src/form-dialog.ts`** (mirrors `openers.ts`) | AR-PL1 (user) |
| Ownership | formDialog creates/owns/**disposes** the form; returns `z.output<S> \| null` | AR-54/55 |
| OK gate | Intercept `ok` → try/caught `await submit(onSubmit)` → drive `endModal(ok)` | AR-56 |
| Sealed gate | Cancel/Esc/quit inert while `submitting()`; `valid()`→false | AR-56 |
| Quit-veto | sync `valid('quit') => form.isValid()` (optimistic; can't force-run async) | AR-56 |
| `submitting()` | new form-level signal (try/finally in `submit()`) | AR-57 |
| onSubmit | optional, in-modal; reject → stay open (caught), no minted error UI | AR-58 |
| Buttons | OK built directly (`disabled: () => submitting()`) + `cancelButton()` | AR-60 |
| Surface | barrel +`formDialog`; surface-lock 5→6 | AR-PL3 |
| Subclass | overrides `handleTerminating`/`resolveCancel`/`valid` | AR-PL7 |

## Related Files

**Create** — `packages/forms/src/form-dialog.ts` (the helper + `FormDialog` subclass) ·
`packages/forms/test/form-dialog.spec.test.ts` (ST-D-SUB1…3 + ST-D1…D10) ·
`packages/forms/test/form-dialog.impl.test.ts` (internals/edges) ·
`packages/forms/test/form-dialog-security.spec.test.ts` (ST-D-SEC) ·
`packages/examples/kitchen-sink/stories/forms-dialog.story.ts` (the `forms/dialog` story).

**Modify** — `packages/forms/src/create-form.ts` (add `submitting` signal + try/finally in `submit()` +
returned object) · `packages/forms/src/types.ts` (add `Form.submitting()`) ·
`packages/forms/src/index.ts` (export `formDialog` + `FormDialogOptions`) ·
`packages/forms/test/surface.impl.test.ts` (5→6 runtime lock) ·
`packages/examples/kitchen-sink/stories/index.ts` (register the story) ·
`packages/examples/test/kitchen-sink.smoke.spec.test.ts` (ST-DS1).

**Deliberately unchanged** — `@jsvision/ui` (composes over public `Dialog`/`execView`/`Button`/`Commands`).
