# Canvas baselines — captured **before** any Phase 2 conversion

These are the pre-conversion renders of the Phase 3 canvases, taken at plan task 2.1.3 against the
tree at `3c888fb8`. They exist because task 2.2.6 converts these very files: a baseline taken
afterwards would bake any replace→merge regression into the "before" and the control would agree
with the defect.

Diff against them twice — at 2.2.6 (the Phase 2 conversion) and again at 3.1.1 (the Phase 3 flex
adoption), so the two deltas stay attributable to the change that caused them.

## What is captured, and why glyphs are enough

Each file is the demo's **own headless walkthrough output, verbatim** — every frame it prints, not a
single snapshot. The originally-specified capture was cell-exact (glyph + fg/bg + attrs + width);
glyph-level was chosen instead because it is strictly sufficient here:

`LayoutProps` (`packages/ui/src/layout/types.ts:64`) carries `direction`, `size`, `justify`, `align`,
`gap`, `padding`, `position` and `rect` — geometry only, no colour and no attributes. So the failure
mode this control exists to catch, a prop surviving a merge that wholesale assignment used to erase,
can only move, resize or clip a box. That is exactly what glyph placement shows. The colour and
attribute dimensions could not report anything the glyphs miss, and capturing them would have meant
standing up a module-interception shim for the eight walkthroughs, none of which expose a mountable
build export.

## Coverage

| Canvas | File | How |
|---|---|---|
| `dropdowns-demo` | `dropdowns-demo.txt` | own walkthrough stdout |
| `containers-demo` | `containers-demo.txt` | own walkthrough stdout |
| `themes-demo` | `themes-demo.txt` | own walkthrough stdout |
| `color-demo` | `color-demo.txt` | own walkthrough stdout |
| `date-demo` | `date-demo.txt` | own walkthrough stdout |
| `status-bar.story` | `status-bar.story.txt` | mounted at 80×24 through its `build(ctx)` |
| `controls-live` | `controls-live-form.txt` | mounted at 58×19 through `buildDialog()` — added at 3.1.2, so it is a **post-Phase-2** capture (see below) |
| `playground` | — | none, and none needed — see below |

### The two TTY-gated canvases

`playground/main.ts:29` and `controls-live/main.ts:68` both `return 0` when `process.stdout.isTTY`
is not `true`, so neither rendered headlessly when the other six baselines were taken. Task 3.1.2
resolved them differently:

- **`controls-live`** got a harness. `buildDialog()` is exported from `form.ts` and carries no TTY
  dependency of its own — only `main.ts` is gated — so its `Dialog` mounts directly into a render
  root. `controls-live-form.txt` is the pre-*flex* baseline for the Phase 3 conversion.
- **`playground`** is left absolute, so it has nothing to diff. Its two sites are a `Window`
  placement and a single `Text` inside it, in the file whose stated purpose is the minimal shell.

Neither one's missing Phase-2 "before" turned out to matter, because a replace→merge swap can only
differ where the target's layout was **non-empty in a prop the write omits**, and neither canvas has
such a site: `playground`'s window write was `win.layout.rect = {…}` — a field write that never
erased anything — and every view `form.ts` places is constructed inline, carrying an empty layout
into the write. That argument holds by construction, for every viewport, which a byte diff would not.

## Reproducing

The five walkthroughs, from `packages/examples`:

```
yarn --silent tsx <canvas>/main.ts
```

The two mounted canvases have committed harnesses beside this file; run them from the repo root:

```
yarn --silent tsx codeops/features/layout-dsl-adoption/plans/layout-field-lockdown/baselines/capture-status-bar.mts
yarn --silent tsx codeops/features/layout-dsl-adoption/plans/layout-field-lockdown/baselines/capture-controls-live-form.mts
```

Each mounts the composition into `createRenderRoot` under pinned truecolor/UTF-8 capabilities (so the
capture never depends on the developer's terminal) and joins the buffer rows with trailing whitespace
stripped.
