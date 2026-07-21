# 03-03 — Kitchen-sink `forms/dialog` story

> **Files**: `packages/examples/kitchen-sink/stories/forms-dialog.story.ts` (NEW),
>   `stories/index.ts` (register), `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (ST-DS1) ·
>   **Owning RD**: RD-08 FR "Kitchen-sink dialog story + smoke", AC #12 · **Register**: AR-61, AR-PL4.

The mandated live demo (CLAUDE.md kitchen-sink gate). It shows the `formDialog` submit-gate flow and
degrades cleanly under the headless smoke mount. Mirrors the modal-story pattern in
`file-dialog.story.ts` ([02-current-state.md](02-current-state.md)).

## Story shape (AR-PL4)

`export const formsDialogStory: Story` with:
- `id: 'forms/dialog'` (unique — smoke asserts uniqueness), `category: 'Forms'`, `rd: 'RD-08'`,
  `title` (e.g. `'Modal form dialog + submit-gate'`), a one-line `blurb`.
- `build(ctx: StoryContext): Group` — a launch `Button` + a live result/state echo `Text` + an
  always-painted hint `Text`, all absolutely placed via the `at()` helper (`story.ts`).

## Live path (`ctx.execView` present — the live shell)

The launch button opens the real `formDialog`, wired through `ctx.execView`:

```ts
const openDialog = (): void => {
  if (ctx.execView === undefined) { result.set('(headless — run demo:kitchen for the modal)'); return; }
  const schema = z.object({ name: z.string().min(1, 'Required'), port: z.coerce.number().int().min(1).max(65535) });
  // `ctx.execView` (the shell's `execModal`) already adds the modal to the desktop, runs it, and removes
  // it — so the ModalDialogHost's desktop must be a NO-OP shim, or the dialog would be mounted twice.
  // `bounds` is only present to satisfy the type; `formDialog` does not read it.
  const host = {
    loop: { execView: ctx.execView },
    desktop: {
      addWindow: () => {},
      removeWindow: () => {},
      bounds: { x: 0, y: 0, width: ctx.width, height: ctx.height },
    },
  };
  void formDialog(host, {
    schema, initial: { name: '', port: '8080' }, title: ' Edit server ', width: 44, height: 9,
    body: (form) => { /* Label + bound Input for name + port; a Text.severity error line, touched-gated */ },
  }).then((values) => result.set(values ? `saved: ${values.name}:${values.port}` : 'cancelled'));
};
```

- The story demonstrates: open → an **invalid OK keeps it open** with a revealed error → a **valid OK
  closes and echoes the coerced values** → **Cancel returns `null`** (echoed as "cancelled") (RD-08 AC #12).
- The body binds `Input`s to `form.field('name'|'port').value` and shows a touched-gated error via
  RD-09's `Text` `severity` (soft integration; the story uses it, the engine mandates none — RD-08
  §"With RD-09").
- **Host wiring (the no-op-desktop shim)**: `formDialog` needs a `ModalDialogHost` (`{ loop:
  { execView }, desktop: { addWindow, removeWindow, bounds } }`), but `StoryContext` exposes **only**
  `ctx.execView` — there is **no `ctx.desktop`** (`story.ts:21-34`). And `ctx.execView` (the shell's
  `execModal`, `shell.ts:198-206`) **already** does `addWindow → execView → removeWindow` itself, so the
  host's desktop must be a **no-op shim** (as above) — a real desktop would mount the dialog twice.
  `bounds` is a stub purely to satisfy the `ModalDialogHost` type (`message-box.ts:22-27` includes it;
  `formDialog` never reads it). This is the live-path shape; it does **not** affect the `formDialog`
  contract, the headless smoke degrade (below), or any `ST-D*` oracle. If, at exec time, the shell has
  grown a real desktop seam on `StoryContext`, prefer it (dropping the no-op shim) and record the change
  in the register with a `(runtime)` tag; otherwise the shim above is the answer.

## Headless degrade (`ctx.execView === undefined` — the smoke mount)

Per `story.ts:30-33` and the `file-dialog.story.ts` precedent: with no `execView`, the story paints only
the launch button + a values/last-result echo + an **always-painted hint** `Text`. The hint string
guarantees the demonstration literals paint even headless (the smoke oracle reads rendered text). No
modal is opened; nothing is clipped (the 44×9 dialog would exceed the 72×16 smoke canvas — the same
reason `file-dialog`/`dialog` stories degrade, RD-08 AC #12 "or a launch button + values echo").

## Registration + smoke (ST-DS1)

- `stories/index.ts`: add `import { formsDialogStory } from './forms-dialog.story.js';` (by the other
  forms stories, `:53-55`) and `formsDialogStory` to the `STORIES` array (by `formsLoadStory`, `:104-106`).
- `kitchen-sink.smoke.spec.test.ts` (ST-DS1) mounts the story headlessly and asserts: it renders
  (paints something), has the unique id `forms/dialog`, and carries the required metadata (`category`,
  `title`, `blurb`). This is the mechanical "the story exists and renders" gate — no TTY (RD-08 AC #12).

## Example/demo code conventions

`packages/examples/` follows the spirit of the documentation directive (it is user-facing +
agent-training material): no `codeops/`/`RD-`/`AR-` refs in the shipped story file, no TV/C++
provenance. The story's own header comment explains the demo in plain language (the `forms-load.story.ts`
header is the model). The RD tag lives only in the `rd: 'RD-08'` **metadata field** (a Story schema
field, not a code comment) — consistent with every existing story.
