# Execution Plan — layout-dsl

> **Feature**: jsvision-ui · **Implements**: jsvision-ui/DX-P8 · **CodeOps Skills Version**: 3.3.2
> **Progress**: 13/23 tasks (57%) · **Last Updated**: 2026-07-08

Spec-first per phase: spec tests → red → implement → green → impl tests → verify. `[ ]` todo ·
`[~]` implemented (unverified) · `[x]` verified. A task is `[x]` only after its verify passes.

**Verify (every phase):** `yarn verify` — one command runs the whole gate (`yarn lint && turbo run
typecheck build test check:docs`); no separate manual lint/typecheck/docs steps (AR-10).

## Phase 1 — Engine `position:'fill'` mode (→ 03-02)

- [x] 1.1 Write `test/layout.fill.spec.test.ts` — ST-1…ST-5; run and confirm **red**. _(2026-07-08)_
- [x] 1.2 `src/layout/types.ts`: extend `position` to `'flow'|'absolute'|'fill'` in `LayoutProps` +
  `ResolvedProps`; `normalizeProps` leaves `rect` undefined for `'fill'`; consumer JSDoc for `'fill'`
  (no CodeOps/TV IDs). _(2026-07-08)_
- [x] 1.3 `src/layout/layout.ts`: flow filter = `position === 'flow'`; place a `'fill'` child at the
  content-box rect and recurse (generalized `placeOutOfFlow`). `src/layout/measure.ts`: exclude
  `'fill'` from `naturalSize`. _(2026-07-08)_
- [x] 1.4 Verify: ST-1…ST-5 **green** AND every existing `layout.*` suite still green (additive);
  full `yarn verify` green (1403 ui tests). _(2026-07-08)_
- [x] 1.5 Write `test/layout.fill.impl.test.ts` — zero-size content box, nested fill-in-fill, fill
  beside multiple flow children; verify. _(2026-07-08)_

## Phase 2 — Builders: col/row/grow/fixed/spacer (→ 03-01, FR-1…FR-4)

- [x] 2.1 Write `test/layout-dsl.spec.test.ts` — ST-6…ST-10 + ST-15; confirm **red**. _(2026-07-08)_
- [x] 2.2 `src/view/dsl.ts`: `Flex`, `toLayout`, `container`/`col`/`row`, `grow`/`fixed`,
  `spacer`, `Empty` (no standalone `fill` helper). Imports `View`/`Group`/`ThemeRoleName` from the
  sibling view modules. Explicit named re-exports `view/dsl.ts` → `view/index.ts` → `src/index.ts`.
  Public builder JSDoc + `@example` written up-front (the phase `check:docs` gate enforces it);
  `col`/`row`/`spacer` use single union-tuple-rest signatures so the doc guard sees one declaration
  per public function. _(2026-07-08)_
- [x] 2.3 Verify ST-6…ST-10 + ST-15 **green**. _(2026-07-08)_
- [x] 2.4 Write `test/layout-dsl.impl.test.ts` — `Flex` precedence matrix, `spacer(0)`, variadic
  children without props; verify (full `yarn verify` green). _(2026-07-08)_

## Phase 3 — Overlays: stack + placement (→ 03-01, FR-5/6/8)

- [x] 3.1 Write `test/layout-dsl-stack.spec.test.ts` — ST-11…ST-14; confirm **red**. _(2026-07-08)_
- [x] 3.2 `src/view/dsl.ts`: `Placement`, `stack`/`Stack` (fills → `position:'fill'`; centered box →
  `absolute` + `View.centered`; corner/edge → `absolute` + `tracked` change-gated self-correct on
  draw), `place`/`centered`/`topRight`/`bottomRight`/`topLeft`; `layerRect`. Added to barrels. _(2026-07-08)_
- [x] 3.3 Verify ST-11…ST-14 **green** (ST-12/14 assert lag-free = single frame; ST-13 settles in 2
  frames and the drain guard proves convergence). _(2026-07-08)_
- [x] 3.4 Write `test/layout-dsl-stack.impl.test.ts` — only-non-fill stack sizes by own `fr`, corner
  clamp when box > stack, `place` re-tag; verify. **`dsl.ts` = 432 lines (≤ 500) — no split.** _(2026-07-08)_

## Phase 4 — Docs, exports, kitchen-sink, hardening (→ FR-10/11)

- [ ] 4.1 JSDoc every public export: lead sentence + gotcha (corners settle; fill/centered do not) +
  `@param`/`@returns` + copy-pasteable `@example`. No banned CodeOps/TV IDs.
- [ ] 4.2 Write `test/layout-dsl.packaging.spec.test.ts` — ST-16 (barrel re-exports + banned-ID grep);
  verify.
- [ ] 4.3 Kitchen-sink: `packages/examples/kitchen-sink/stories/layout-dsl.story.ts` (a resizable
  shell showcasing col/row/stack/grow/fixed/spacer) + register in `stories/index.ts`; confirm ST-17
  via `kitchen-sink.smoke.spec.test.ts`.
- [ ] 4.4 Full verify: `yarn verify` (runs lint + typecheck + build + test + check:docs) green,
  including the existing `layout.*`/`view.*`/`kitchen-sink.smoke` suites.
- [ ] 4.5 `CHANGELOG.md` entry (Added: declarative layout builders + `position:'fill'`); roadmap sync
  via the roadmap skill.

## Notes

- Purely additive: no existing public API behavior changes; the engine change is a new `position`
  value only (existing `flow`/`absolute` untouched).
- No raw git in this plan — commit via `/gitcm` / `/gitcmp` per the active exec_plan commit mode.
