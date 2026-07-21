# 03-03 — Canvas Adoption (#129)

> **Document**: 03-03-canvas-adoption.md
> **Parent**: [Index](00-index.md)
> **Implements**: FR-9…FR-11 · AR-9, AR-10 · RD-01 FR-6 · RD-02

## Objective

Convert the deliberate absolute demo canvases to `col`/`row` composition where they are
structurally flex, and retire the last five names that shadow a DSL builder.

This phase is **different in kind** from the two before it. Phases 1 and 2 are mechanical and
compiler-verified. This one is per-file *design*: a canvas may legitimately stay absolute, and the
compiler cannot tell you which. It is last so that it runs with both the compiler (Phase 1) and a
render control (AR-9) behind it.

## The canvases — 18 sites across 8 files

| Canvas | Sites |
|---|---|
| `dropdowns-demo/main.ts` | 6 |
| `containers-demo/main.ts` | 5 |
| `playground/main.ts` | 2 |
| `themes-demo/main.ts` · `color-demo/main.ts` · `date-demo/main.ts` · `controls-live/form.ts` · `kitchen-sink/stories/status-bar.story.ts` | 1 each |

`tabs-demo` is named in #129 but carries **0** write sites — it needs no conversion. Confirm
before opening it.

**Out (keep-absolute by RD-01):** window/desktop placement, the polar `analog-clock`, and the
movable-window desktop apps. **Out (AR-8, prior decision):** `view-demo/main.ts` and
`kitchen-sink/stories/layout.story.ts` teach the raw spine — Phase 2 changes their *writer*; this
phase must not change their *shape*.

## The five name shadows (AR-10)

| Site | Shape | Work |
|---|---|---|
| `theme-designer/src/view/gallery.ts:32` | `at(g, view, x, y, w, h)` — places **and** adds | conversion: call sites become `g.add(at(v, …))` |
| `theme-designer/src/view/inspector-panel.ts:55` | same | same; note `host/walkthrough.ts` never renders the inspector, so there is no headless witness — rely on the render control plus review |
| `examples/keyboard-mouse-playground/main.ts:126` | `const row = (y, label, value)` | rename or retire |
| `examples/amiga-clock/analog-clock.ts:70` | `const at = (frac, rad, str, style)` | polar-plot helper; rename — this is not a placement helper at all |
| `examples/kitchen-sink/stories/layout.story.ts:30` | `const row = new Group()` | one-word rename |

Two of these are genuine conversions, two are renames, one is a helper whose *name* collides while
its meaning does not. Do not treat them as a uniform batch.

## Verification — the render control (AR-9)

**Capture the baseline at the head of Phase 2, not here.** Phase 2 task 2.2.6 converts all ~55
`examples/**` sites — which includes every one of these 18 — and that conversion is itself a
replace→merge semantic change. A baseline captured after Phase 2 bakes any regression into the
"before" snapshot, so it could never appear in a Phase 3 diff. This is not hypothetical: the control
exists because it caught the `demo-shell` replace-semantics defect while `paint-smoke` stayed green,
and `paint-smoke` is Phase 2's only backstop for these files. So: capture against pre-conversion
`master`, diff once after 2.2.6, and again after 3.2.x.

**Two canvases have no headless witness.** `playground/main.ts:29-34` and
`controls-live/main.ts:68-75` both print a TTY notice and `return 0` when `process.stdout.isTTY`
is not `true`. Nothing else imports `playground/main`, and `controls-live/form.ts`'s `buildDialog`
is reachable only through that gated entry (the `demo:controls` the file suggests is a different
demo that never renders `form.ts`). Options, in order of preference: build a small harness that
imports the composition function directly and mounts it into
`createRenderRoot({ width: 80, height: 24 })` — the pattern `themes-demo/main.ts:63-67` already
uses; or record them review-only alongside `inspector-panel`; or simply leave them absolute, which
`playground/main.ts:52` warrants anyway since it is a `win.layout.rect` window placement RD-01 keeps
absolute. Decide per canvas at execution and record which.

For each canvas with a witness, before conversion:

1. Render at a fixed viewport (80×24) through its own harness.
2. Dump every cell as `glyph | fg / bg / attrs / width` — **not** glyphs alone. A merge-preserved
   `padding` shifting a child by one cell, or a theme role changing, is invisible in a glyph-only
   diff.
3. Convert.
4. Re-render and diff.

**Byte-identical is the expected result for a behaviour-preserving conversion.** A flex conversion
that deliberately changes layout (the point of FR-6 for some canvases) produces a diff that is
**reviewed, explained and recorded** — not required to be empty, and never accepted unexamined.

This is the control that caught the `demo-shell` replace-semantics defect in the preceding plan:
six examples byte-identical, one intended change, and the defect surfaced as a canvas rendering
its echo line vertically down a one-cell column. `paint-smoke` had stayed green at 423 painted
cells throughout.

## Risks

| Risk | Mitigation |
|---|---|
| A canvas is not structurally flex and is converted anyway | Per-file judgment; a canvas may stay absolute — record why |
| A conversion changes layout subtly | The render control is cell-exact, including colour and attributes |
| `inspector-panel`, `playground` and `controls-live` have no headless witness | Explicit review, or a purpose-built harness; named in AC-8 so the all-clear stays honest |
| The baseline is captured after Phase 2 already mutated these files | Capture moves to the head of Phase 2 (task 2.1.3) |
| Scope creep into keep-absolute territory | The exclusion list above is explicit and derives from RD-01 |
