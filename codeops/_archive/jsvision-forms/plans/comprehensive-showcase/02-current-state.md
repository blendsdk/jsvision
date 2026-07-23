# 02 — Current State

> **Implements**: jsvision-forms/RD-05
> Grounds every design claim in [03-01-showcase-story.md](03-01-showcase-story.md) against real code.

## The Forms suite today

The kitchen-sink `Forms` category already holds four capability stories, each a focused demo:

| Story id | File | RD | Demonstrates |
|----------|------|-----|--------------|
| `forms/form` | `stories/forms.story.ts` | RD-04 | The 5 binding paths, touched-gated errors, `valid · dirty` echo, submit gate. |
| `forms/async` | `stories/forms-async.story.ts` | RD-06 | `asyncValidators` debounced availability, `checking…` / async-error / `✓ available`. |
| `forms/load` | `stories/forms-load.story.ts` | RD-07 | `form.load(loader)` → `Loading…` swap → pristine rebase → edit → reset-to-loaded. |
| `forms/dialog` | `stories/forms-dialog.story.ts` | RD-08 | `formDialog()` modal submit-gate; the no-op-desktop host shim. |

Registration is explicit (no import side-effects): a story is a `*.story.ts` exporting a `Story`,
plus one import + one array entry in `stories/index.ts` (`stories/index.ts:53-56,105-108`).

## The Story contract (`kitchen-sink/story.ts`)

- `Story = { id, category, title, blurb, rd?, build(ctx): Group }` (`story.ts:37-56`).
- `build(ctx)` returns a `Group` of **absolutely-positioned** children within `ctx.width ×
  ctx.height`; the shell owns all chrome (`story.ts:9-13`).
- `StoryContext = { caps, width, height, execView? }`; `execView` is **`undefined` in the headless
  smoke test** (`story.ts:28-34`) — the dialog affordance must degrade.
- Helper `at(view, x, y, w, h)` sets the absolute rect (`story.ts:69-73`).

## Engine surface the story consumes (all already shipped — AR-PL7)

- **`Form` accessors** (`packages/forms/src/types.ts`): `values()` (`:63`, `z.output<S> | null`),
  `rawValues()` (`:65`, `I`), `errors()` (`:67`, `ZodIssue[]`), `isValid()` (`:74`), `dirty()`
  (`:76`), plus `validating()` / `loading()` / `submitting()` — the inspector reads these directly.
- **Binding**: `createForm`, `bindField`, `bindRadio`, `bindCheck`, `formDialog`, `AsyncValidator`,
  `FormDialogOptions` — the full barrel (`packages/forms/src/index.ts`).
- **`asyncValidators` + `asyncDebounceMs`** on `createForm` (used in `forms-async.story.ts:56-64`).
- **`form.load(loader)` + `loading()`** (used in `forms-load.story.ts:57-80`).
- **`formDialog(host, options)`** (used in `forms-dialog.story.ts:52-81`).

## UI surface the story consumes

- **`Text.severity: 'warning'`** → the amber `warningText` theme role (RD-09). Idiom:
  `new Text(() => msg, { severity: 'warning' })` (mirrors the `'error'` use in
  `forms-async.story.ts:79`).
- **Layout DSL**: `col`, `row`, `grow`, `fixed`, `spacer`, `stack` exported from `@jsvision/ui`
  (`packages/ui/src/index.ts:52`). Usage anchor: `layout-dsl.story.ts:44-71` —
  `col(opts, ...children)` / `row(opts, ...children)` / `fixed(view, size)` / `grow(view)`, and the
  "merge an absolute rect onto `frame.layout`" trick to place a DSL frame in a story
  (`layout-dsl.story.ts:64-71`).
- **Stock widgets**: `Input`, `Switch`, `RadioGroup`, `CheckGroup`, `Button`, `Label`, `Text`,
  `signal` (`@jsvision/ui`).

## Reusable idioms (copy verbatim — consistency, AR-PL6)

- **Abortable delay** for simulated async: `sleep(ms, signal)` — identical in
  `forms-async.story.ts:21-33` and `forms-load.story.ts:22-34`.
- **The `formDialog` host shim** (headless-safe, no double-mount): `forms-dialog.story.ts:38-47`
  (no-op `addWindow`/`removeWindow`, a `bounds` stub, and the generic `execView` re-expose).
- **Always-painted hint** that guarantees a demo literal paints headlessly:
  `forms-async.story.ts:120`, `forms-load.story.ts:100`, `forms-dialog.story.ts:88-98`.

## Smoke harness (`test/kitchen-sink.smoke.spec.test.ts`)

- Canvas **`WIDTH=72, HEIGHT=16`** (`:39-40`); `caps` truecolor (`:38`).
- Per-story oracle: `createRoot` → `at(build(...),0,0,W,H)` → `createRenderRoot` → `mount` →
  reconstruct painted text (`rows.map(...).join`) → assert characteristic `/regex/` matches
  (pattern: ST-N1 `:269-287`, ST-AS1 `:295-314`, ST-LS1 `:320-339`, ST-DS1 `:345+`). ST-SS1 follows
  this shape exactly.

## Constraints surfaced

- The live advisory (AC-4) only paints when `port < 1024`; at the default initial `port` it is
  absent — so the smoke oracle must key off an **always-painted hint literal**, not the live
  advisory (AR-PL8), exactly as the siblings do for their reactive affordances.
- The real shell canvas is narrower than 72 (the 24-col navigator sidebar is subtracted,
  `shell.ts:38,191`) — the `col`/`row` layout must reflow rather than assume a fixed width.
