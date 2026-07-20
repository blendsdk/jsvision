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
| `playground` | — | **no baseline** — see below |
| `controls-live` | — | **no baseline** — see below |

`playground/main.ts:29` and `controls-live/main.ts:68` both `return 0` when `process.stdout.isTTY`
is not `true`, so neither renders headlessly at all. Task 3.1.2 already owns the decision about what
witness they get (a mount harness, review-only, or left absolute); pre-building one here would
front-load a design decision the plan deliberately placed in Phase 3. They are recorded as having no
Phase-2 "before", and 3.1.2 must account for that.

## Reproducing

The five walkthroughs, from `packages/examples`:

```
yarn --silent tsx <canvas>/main.ts
```

`status-bar.story` is mounted through `createEventLoop({ width: 80, height: 24 })` after calling
`statusBarStory.build({ width: 80, height: 24 })`, and its buffer rows are joined with trailing
whitespace stripped.
