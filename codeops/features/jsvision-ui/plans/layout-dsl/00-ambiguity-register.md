# Ambiguity Register — layout-dsl

> **Feature**: jsvision-ui · **Plan**: layout-dsl · **CodeOps Skills Version**: 3.3.2
> **Status header**: ✅ GATE PASSED — all items resolved with explicit decisions
> **Last Updated**: 2026-07-08

Systematic inventory of every gap, ambiguity, and unstated assumption for the layout-dsl feature.
User decisions (AR-1…AR-4) were captured interactively; AR-5…AR-13 are design details derived from
AR-1 or from a user-approved throwaway user-land prototype (a self-contained working step, not a
retained artifact) — the full design is transcribed self-contained in 03-01/03-02 and is the source
of truth. Preflight (see `00-preflight-report.md`) revised AR-5, AR-10, and AR-12.

| # | Category | Ambiguity | Options considered | Resolution | Source |
|---|----------|-----------|--------------------|------------|--------|
| AR-1 | Architecture | How to make a nested overlay fill its parent lag-free — the engine has no per-view bounds hook (`view.ts:65`), so absolute needs a static rect. | (a) `position:'fill'` per-child; (b) `direction:'stack'` per-container; (c) no engine change (self-correct everything). | **(a) `position:'fill'`** — a child takes the parent's whole content box, overlaps siblings, reserves no flow space; composes with flow+absolute siblings in one container. | ✅ User |
| AR-2 | Scope / edge cases | Corner/edge overlays can't be lag-free with the minimal `fill` mode (a fixed box pinned to an edge is not a full-box fill). | (a) ship with a documented 1-frame settle; (b) defer corner helpers to v1.1. | **(a) Ship with the 1-frame settle** — fills + centered stay lag-free; only corner/edge overlays self-correct on draw. | ✅ User |
| AR-3 | Naming | The kitchen-sink already exports `at(view,x,y,w,h)` (absolute pixel placement, `packages/examples/kitchen-sink/story.ts:69`); the DSL's placement helper is `at(view, placement)` — same name, different meaning. | (a) rename to `place`; (b) keep `at`. | **(a) `place(view, placement)`** — no cross-codebase `at` collision. | ✅ User |
| AR-4 | Scope | Migrate the 38 existing `{ size: { kind: 'fr', weight: 1 } }` sites to the new shorthands? | (a) out of scope (defer); (b) include in this feature. | **(a) Out of scope** — ship additively; a separate follow-up migrates once proven. | ✅ User |
| AR-5 | File structure | Module location + export surface. | `layout/dsl.ts` vs `view/dsl.ts` vs a new `src/dsl/`; which barrels re-export. | **`packages/ui/src/view/dsl.ts`** (single file; split only if it approaches 500 lines). The builders construct `Group`/`View` and reference `ThemeRoleName` — all `view/` values — so they belong in the view layer, which already depends on `layout/`. Placing them in `layout/` would invert the strict view→layout layering and risk a `layout/index → dsl → view → reflow → layout/index` import cycle. Explicit named re-exports from `view/index.ts` → `src/index.ts`. The engine `position:'fill'` change (03-02) stays in `layout/`. | Preflight PF-001 |
| AR-6 | Behavior | Precedence when a container gets both a shorthand (`grow`/`fixed`/`fill`) and an explicit `size`. | shorthand wins vs explicit `size` wins. | **Explicit `size` wins** (shorthand only fills when `size` is absent) — matches `toLayout()` in the approved prototype. | Prototype |
| AR-7 | API | `spacer()` argument shape. | weight-only vs fixed-only vs both. | `spacer(weight = 1)` (flexible) **and** `spacer({ fixed: n })` (hard gap) — the approved prototype's overload. | Prototype |
| AR-8 | Behavior | How a `position:'fill'` child participates in sizing. | reserves flow space? contributes to intrinsic size? | Like `absolute`: removed from the flex flow (reserves **no** main-axis space, never shifts flow siblings), excluded from the parent's intrinsic `naturalSize` (`measure.ts` flow filter extended), and recurses into its own subtree at the content-box size. | Derived from AR-1 |
| AR-9 | Behavior | `stack()` layer wiring after `fill` lands. | which mechanism per layer kind. | Fill layers → `position:'fill'` (multiple fills all overlap, lag-free). Centered fixed box → `position:'absolute'` + the existing `View.centered` re-centering (lag-free, `reflow.ts:47`). Corner/edge → `position:'absolute'` + draw-time self-correction (the AR-2 settle). | Derived from AR-1/AR-2 |
| AR-10 | Testing | Verify command + the tsconfig-excludes-test constraint. | — | `yarn verify` already runs the full gate: `yarn lint && turbo run typecheck build test check:docs` (lint, per-package `tsc --noEmit`, build, vitest, and the JSDoc/`@example` check) — no separate manual steps are needed. UI `tsconfig` excludes `test/` and vitest does not type-check, so every `*.spec.test.ts` oracle must assert **runtime/behavioral** results (rects, buffer cells, file reads), never types alone. | Preflight PF-003 (root `package.json`) |
| AR-11 | Completeness | Kitchen-sink obligation (non-negotiable). | — | One `layout/dsl` story showcasing `col`/`row`/`stack`/`grow`/`fixed`/`spacer` + the headless smoke test; not `[x]` until both exist and pass. | CLAUDE.md |
| AR-12 | API | The public export surface. | which names ship. | Values: `col`, `row`, `stack`, `grow`, `fixed`, `spacer`, `place`, `centered`, `topRight`, `bottomRight`, `topLeft`. Types: `Flex`, `Placement`. (`toLayout` stays internal.) The standalone `fill(view)` helper is **dropped** — it was identical to `grow(view)` and its name collided with the engine `position:'fill'` overlay mode and the `{ fill: true }` container prop; `grow(view)` covers it. `fill` survives only as a `Flex` prop key and the engine placement value. | Preflight PF-002 |
| AR-13 | Behavior | `fill`'s interaction with `justify`/`align`. | — | A `fill` child is outside the flow, so `justify` never positions it and it fills regardless of `align`; it always maps to the full content box. | Derived from AR-1 |

**Gate check:** every row Status = ✅; AR-1…AR-4 carry explicit user decisions; AR-5…AR-13 are
direct derivations of AR-1 or self-contained design decisions transcribed in 03-01/03-02 (AR-5/10/12
revised by preflight). Zero items deferred. **Gate is OPEN.**
