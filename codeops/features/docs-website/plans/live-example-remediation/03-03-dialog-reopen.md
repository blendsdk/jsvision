# 03-03 — Workstream C: Dialog reopen

> Bug #7 · AR-3, AR-14 · Phase 3 (AR-7 order). Depends on the unified shell (03-02).

## Problem

`controls/form-dialog.ts` (`:49-50`) and `files/file-dialog.ts` (`:44`) call `execView` once in
`build()`. On OK/Cancel/Esc the example is dead — no reopen path.

## Design

Both are `app` kind (they need the loop's `execView`, unavailable to a bare-`View` component). Under
the unified shell they build `demoApp(ctx)` (no Window menu) and add a **centered, non-closable stage
Window** hosting an **"Open the dialog" Button** (+ a one-line hint). The button (re)opens the modal
each time; the example starts with it open once.

### Shared reopen mechanism

Each example defines an `openTheDialog()` closure that builds a **fresh** dialog, adds it to the
desktop, and `execView`s it (resolving/removing on close), then binds it to a command:
```
app.onCommand('demo.openDialog', () => openTheDialog());
// stage window:
const stage = new Window('Dialog demo'); stage.closable = false;
stage.layout.rect = <centered small rect>;
stage.add(<Button('~O~pen the dialog', { command: 'demo.openDialog', default: true }) + a hint Text>);
app.desktop.addWindow(stage);
openTheDialog();   // start with it open once
```
Fresh-per-open keeps state clean (a form's Age resets each open); a fresh dialog avoids re-adding a
disposed view. On resolve, remove the dialog from the desktop so the stage Window's button regains
focus.

### `controls/form-dialog.ts`

`openTheDialog()` builds the `Dialog` + `Input`/`CheckGroup`/`RadioGroup`/`okButton`/`cancelButton`
(today's `build()` body, with **fresh signals per call**), `addWindow` + `execView`, and removes it
on resolution. The stage Window's Button emits `demo.openDialog`.

### `files/file-dialog.ts`

`openTheDialog()` calls `openFile(app, { fs: seedFs(), directory: HOME, title: 'Open a file' })`
(the existing opener already runs modally via the app). A fresh `seedFs()` per open keeps the tree
pristine. The stage Window's Button emits `demo.openDialog`.

## Coverage (AR-6)

`packages/docs-site/test/*` — a headless test drives each dialog example: after `build()` the modal
is active; end it (resolve/cancel); assert the stage Window + its Button survive and emitting
`demo.openDialog` re-activates a modal. (Deterministic via the loop; no browser.) The visual is in
the manual checklist (07 §Manual).
