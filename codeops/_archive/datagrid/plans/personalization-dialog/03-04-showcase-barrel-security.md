# Showcase, Barrel & Security: Personalization Dialog

> **Document**: 03-04-showcase-barrel-security.md
> **Parent**: [Index](00-index.md)

## Overview

The user-facing surface + hardening: the datagrid-local kitchen-sink story (the NON-NEGOTIABLE gate), the
`datagrid-showcase` demo (new `'Personalization'` category, AR-9), the barrel exports, and the
consolidated security oracle. Owns RD-16 AC#13, AC#14.

## Kitchen-sink story (mandatory gate)

New `packages/datagrid/test/kitchen-sink/stories/personalization.story.ts` exporting a `Story`
(`{ id, category, title, blurb, rd, build(ctx) }`) + one import + one array line in
`stories/index.ts`. `build(ctx)` returns a `Group` of absolutely-positioned children within
`ctx.width × ctx.height`.

- The kitchen-sink shell owns modality differently from the showcase — the story cannot itself run a
  modal `execView`. So the story renders a **static composition of the dialog's regions** (a column list
  with a couple of composite rows + the variants panel) plus a bound-state echo, exercising the widgets
  headlessly. This satisfies the smoke gate (`kitchen-sink.smoke.spec.test.ts`: unique id, required
  metadata, paints ≥1 non-blank cell — `toBeGreaterThan(0)`, **no fixed count to re-base**).
- `id: 'datagrid/personalization'`, `category: 'DataGrid'`, `rd: 'RD-16'`; imports from `@jsvision/ui`
  and `../../../src/index.js`.

## Showcase demo (new `'Personalization'` category)

New `packages/examples/datagrid-showcase/stories/personalization/personalize.story.ts` + registration in
`stories/index.ts` under a new `'Personalization'` category.

- The showcase `StoryContext` carries an optional `execView?(modal): Promise<unknown>` seam (the modal
  host) — the demo's launch `Button` calls `ctx.execView` to open `personalizeGrid`; live-echoes the
  resulting layout; seeds a `createMemoryVariantStore()` with a couple of variants.
- **Graceful degradation** — `execView` is `undefined` under the headless smoke test. The demo MUST still
  render its launch control + echo (guard the launch on `ctx.execView` presence). The walkthrough test
  drives `emitCommand(story.id)`; the demo carries an `rd: 'RD-16'` chip (the `disposedCount()` swap check
  reads the chip).

### Oracle changes (showcase smoke — `packages/examples/test/datagrid-showcase.smoke.spec.test.ts`)
- **ST-5 CATEGORIES** (lines ~73-88): add `'Personalization'` to the expected category list.
- **ST-7** per-cluster counts (~line 114 region): add `expect(counts['Personalization']).toBe(1)`.
- **ST-6 roadmap band** (`toBe(1)`): **unchanged** — there is no RD-16 placeholder to remove (recon).
- Iteration-based tests (ST-8 walkthrough, ST-9 disposedCount, ST-10 seed) need no re-base.

> Examples tests import the **built** `@jsvision/datagrid` dist by name — **rebuild datagrid** before
> running the showcase tests (a recorded project gotcha) or you assert against stale code.

## Barrel exports (`packages/datagrid/src/index.ts`)

One `export { … } from './<module>.js'` block per module, each with a JSDoc header (as `index.ts:51-57`):

- **Values (need `@example` — `check:docs` Check B):** `personalizeGrid` (from `personalize.js`),
  `createMemoryVariantStore` (from `variant-store.js`).
- **Types (`export type`, exempt):** `PersonalizeOptions`, `PersonalizeResult` (from `personalize.js`);
  `VariantStore` (from `variant-store.js`); `GridColumnInfo` (from `variant.js`).
- The new grid methods (`columns`/`defaultColumnLayout`/`clearColumnWidth`) are on the already-exported
  `EditableDataGrid` class → each needs an `@example` on the method JSDoc.

> **Banned-reference check:** the `check-jsdoc` scanner has a known grid.ts gap — **grep**
> `packages/datagrid/src` for `RD-`/`AR-`/`PF-`/`plans/`/`codeops/`/`requirements/` before finalizing;
> `check:docs` alone will not catch a stray id in grid.ts.

## Security oracle

Consolidated into the existing datagrid security spec (`security.spec.test.ts`) + the dialog specs
(RD-16 AC#14):
- **Variant name** — `sanitize` (control bytes stripped, no raw ESC/BEL in the frame) + `trim`-empty
  rejection + `maxLength:64` hard cap at entry. Rendered/stored sanitized.
- **Width** — `filter('0-9')` digit-filter (empty allowed) + `clampWidth` clamp to `[minWidth, maxWidth]` on OK (not a `range()` OK-gate — PF-001).
- **Apply** — an unknown column id in a variant is skipped, not executed (RD-13 drop-unknown); filter
  operands are structured literals, never concatenated.
- **No new core theme roles** — the dialog reuses `Dialog` roles (AR-57); assert the role count is
  unchanged.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Showcase demo mounted with no `execView` (headless smoke) | Render launch control + echo; skip the modal open | AR-9 |
| A stray plan-id reaches shipped source past `check:docs` | Grep gate over `packages/datagrid/src` | — |
| A new public value lacks an `@example` | `check:docs` fails the build | RD-16 AC#13 |

> **Traceability:** see [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements
- Security oracle: name sanitize + cap + empty-reject; width digit-filter + clamp; apply drop-unknown; role-count unchanged. ST-26.
- Story + showcase mount headlessly and paint; `check:deps` zero-dep. ST-27.
