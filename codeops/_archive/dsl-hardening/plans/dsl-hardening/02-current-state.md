# Current State: DSL Hardening

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`packages/ui/src/view/dsl.ts` (442 lines) is the whole DSL: `col`/`row` (via a private
`container()`), `grow`/`fixed`/`spacer`, and the `stack` z-overlay with `place`/`centered`/
`topRight`/`bottomRight`/`topLeft` placement taggers (a `WeakMap<View, Placement>` read by
`stack()`). It only constructs `Group`/`View` and sets ordinary `.layout` props — there is no
separate runtime. The engine (`packages/ui/src/layout/`) already supports everything the new
builders need: `Size.fr.min` (`types.ts:39-47`, normalized in `normalizeSize`), and
`position:'absolute'`/`'fill'` children being **removed from flex flow** (`layout.ts:84`,
`placeOutOfFlow` at `layout.ts:126`).

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/view/dsl.ts` | the entire DSL | split into `dsl/{flex,stack,absolute}.ts` + `index.ts` (R8); add S1/S2/S3/S5/S7 |
| `packages/ui/src/view/index.ts` | view barrel (re-exports the DSL) | add `at`/`cover`/`center`; path becomes `./dsl/index.js` |
| `packages/ui/src/index.ts` | package barrel | add `at`/`cover`/`center` to the DSL re-export line |
| `packages/ui/src/layout/types.ts` | `Placement` is defined in `dsl.ts`, but `Size`/`Rect`/`Padding` here | S5 offset fields live on `Placement` (in `dsl/stack.ts`); no engine type change (min already exists) |
| `packages/ui/src/split/split-view.ts` | S1 consumer | pane loop `{fr, weight, min}` → `grow(v, w, { min })` (R9) |

### Code Analysis

- `grow(view, n)` (`dsl.ts:136`) = `{ ...view.layout, size:{ kind:'fr', weight:n } }` — drops `min`.
  `fixed()` (`dsl.ts:155`) is exact (no `min`). The `col`/`row` shorthand resolves the size token in
  `toLayout()` (`dsl.ts:50`), also min-less.
- `container()` (`dsl.ts:71-87`) adds every arg unconditionally: `for (const child of children) group.add(child)` — a falsy arg is passed straight to `.add()` (R7 gap).
- Placement taggers set a `WeakMap` entry consumed only inside `stack()` (`dsl.ts:328`); called on a
  non-stack child they are a **silent no-op** (R5 gap). `layerRect()` (`dsl.ts:223-237`) resolves an
  axis to `start`/`center`/`end` of a fixed size — **no offset** (R6 gap).
- There is **no** absolute-coordinate builder; `place(view, Placement)` (`dsl.ts:374`) is the
  stack-layer tagger, not an `{x,y,w,h}` placer. ~15 files hand-roll their own `at()`/`place()`
  (`packages/examples/kitchen-sink/story.ts:69`, the docs examples, `ui/src/dialog/message-box.ts:58`,
  `ui/src/editor/dialogs.ts:38`, `forms/src/form-dialog.ts:59` — the last shadows the DSL `place`).

## Gaps Identified

### Gap 1 (S1): size shorthands drop `min`
**Current:** `grow(v, n)` cannot express a floor; `split-view.ts` writes the token by hand.
**Required:** `grow(v, w, { min })` + shorthand form, forwarding to `Size.fr.min`.
**Fix:** R1 — see `03-02`.

### Gap 2 (S2/S4): no absolute-placement builder
**Current:** absolute placement is hand-rolled everywhere, often replacing (not merging) `.layout`.
**Required:** one blessed `at()`, merge-preserving; usable as an out-of-flow `col`/`row` child.
**Fix:** R2/R3 — see `03-03`.

### Gap 3 (S3): single-child fill/center needs a `stack()`
**Current:** stack fill/`centered` only work as stack layers; standalone use silently no-ops.
**Required:** standalone `cover()`/`center()`; a dev-warn when a tagger is orphaned.
**Fix:** R4/R5 — see `03-03`, `03-04`.

### Gap 4 (S5): no placement offset
**Current:** a placed layer can only sit at start/center/end of its size.
**Required:** `hOffset`/`vOffset` on `Placement`.
**Fix:** R6 — see `03-04`.

### Gap 5 (S7): builders crash on falsy children
**Current:** `col(cond && child, …)` passes `false` to `.add()`.
**Required:** skip `null`/`undefined`/`false`.
**Fix:** R7 — see `03-02`.

### Gap 6 (arch): `dsl.ts` size
**Current:** 442 lines; the additions push it past the ~500 target toward the 700 split threshold.
**Required:** cohesive `dsl/` modules, public API unchanged.
**Fix:** R8 — see `03-01`.

## Dependencies

### Internal Dependencies
- The engine's `Size.fr.min` and out-of-flow `absolute`/`fill` handling (already shipped — this plan
  only surfaces them through builders). No engine changes.
- `View`/`Group` (`dsl` constructs them); `LayoutProps`/`Size`/`Rect`/`Padding` types.

### External Dependencies
- None. Zero runtime deps (enforced by `check:deps`).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The `dsl/` split changes import specifiers and breaks the barrel / a deep import | Med | Med | Do the split first as its own phase; keep `view/index.ts` re-exporting identical names; the existing `dsl.*`/`layout.*`/packaging spec suites are the green oracle (Phase 1 verify). |
| `split-view` migration regresses min behavior | Low | Med | `split.spec.test.ts` is the immutable oracle — it must stay green unchanged; add an impl test asserting the pane token carries `min`. |
| A new export name collides in the barrel | Low | High | Corrected (AR-12 / PF-001): `at`/`cover`/`center` are free and new; `fill` is avoided — the packaging oracle bans it and `Flex.fill` (grow:1) already exists. |
| `center` vs `centered` confuses consumers | Med | Low | Distinct roles documented in both JSDoc `@example`s (AR-4). |
| Falsy-filter hides a genuine bug (a child that evaluated to `undefined` unintentionally) | Low | Low | Only `null`/`undefined`/`false` are skipped — the standard conditional-render idiom; documented. |
