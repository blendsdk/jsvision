# Ambiguity Register: DSL Hardening

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Status**: ✅ GATE PASSED
> **Created**: 2026-07-18 22:25

Every semantically-weighty decision this plan commits to, with the user's resolution. Decisions
marked *(delegated)* were explicitly delegated by the user to the planner's recommendation
("recommend me the best possible options to go forward"), which the user then accepted.

| AR | Category | Ambiguity | Options | Decision | Status |
|----|----------|-----------|---------|----------|--------|
| AR-1 | Scope | Which DSL gaps (S1–S8) does THIS plan build? | (a) all S1–S8; (b) only those with a real consumer | **(b)** — build **S1, S2, S3, S5, S7** (each has a consumer; S4 falls out of S2 for free). **Defer S6 and S8** — no consumer found in the sweep (building unused public API is over-engineering); they stay tracked in GH #113. | ✅ Resolved *(delegated)* |
| AR-2 | API / Naming | `size.min` shape on `grow()`/`fixed()` + the `col`/`row` shorthand | (a) options object; (b) positional third arg | **(a)** `grow(view, weight?, { min })`; shorthand `grow: number \| { weight, min }`. Extensible (future `max` needs no positional shuffle), clearer call sites. | ✅ Resolved *(delegated)* |
| AR-3 | API / Naming | `at()` absolute-placement builder signature | (a) positional `(view,x,y,w,h)`; (b) `(view, rect)`; (c) both | **(c)** positional canonical `at(view, x, y, width, height)` (matches the ~15 hand-rolled helpers → mechanical migration) **+ a `at(view, rect)` overload** for the internal `(view, rect)` sites. **Merge-preserving** (`{...view.layout, position:'absolute', rect}`), returns the view, **pure** (never auto-`.add()`s). | ✅ Resolved |
| AR-4 | API / Naming | Standalone fill/center vs the existing stack-layer `centered()` | (a) new standalone builder + `center()`; (b) overload `centered()` to be dual-mode | **(a)** `cover(view)` + `center(view, w, h)` act directly (no `stack()` wrapper), returning the view. **Named `cover`, not `fill`** (revised by preflight PF-001): a standalone `fill` export is banned by the immutable packaging oracle (`layout-dsl.packaging.spec.test.ts:52`) and would collide with the existing `Flex.fill` shorthand (grow:1 — the opposite meaning). Existing stack-layer `centered()`/`place()` unchanged. Docs state the **`cover` vs `Flex.fill`** and **`center` (standalone) vs `centered` (stack layer)** distinctions. | ✅ Resolved (revised — PF-001) |
| AR-5 | Behavior | Misusing `centered()`/`place()` outside a `stack()` (silent no-op today) | (a) dev-warn; (b) throw; (c) leave silent | **(a)** a dev-only `console.warn` (no throw, no prod cost) when a placement tagger's view is not adopted by a `stack()`. | ✅ Resolved *(delegated)* |
| AR-6 | API / Naming | S5 placement offset shape | (a) `hOffset`/`vOffset` numbers on `Placement`; (b) a margins object | **(a)** optional `hOffset`/`vOffset` integer cells on `Placement`, applied after start/center/end. Consumer: `errorBox` (GH #115). | ✅ Resolved *(delegated)* |
| AR-7 | Behavior | Falsy children in `col`/`row`/`stack` | (a) skip `null`/`undefined`/`false`; (b) leave (crashes today) | **(a)** filter `null`/`undefined`/`false` in the add loops → enables `col(cond && fixed(x,1), grow(y))`. | ✅ Resolved *(delegated)* |
| AR-8 | Architecture | `dsl.ts` (442 lines) will cross the ~500 target with the additions | (a) split into a `dsl/` folder now; (b) keep one file | **(a)** refactor to `dsl/{flex,stack,absolute}.ts` + `dsl/index.ts` barrel; `view/index.ts` and `@jsvision/ui` public exports unchanged. Mechanical move, no behavior change. | ✅ Resolved |
| AR-9 | Scope | Consumer migration boundary | (a) capabilities + tests only; (b) also migrate `split-view.ts` | **(b)** migrate `split-view.ts` panes to `grow(v, w, { min })` as a real-world S1 proof. **No other** consumer/demo migration (that stays in the port issues #109–#115). | ✅ Resolved |
| AR-10 | Scope | Include a `max` size option alongside `min`? | (a) no; (b) yes | **(a)** No — the engine has no `max` and there is no consumer. Adding it would need an engine change first; out of scope. | ✅ Resolved *(delegated)* |
| AR-11 | Process | Verify command | detected from CLAUDE.md | **`yarn verify`** (`yarn lint` then `turbo run typecheck build test check:docs`). | ✅ Resolved |
| AR-12 | Naming | New public export names collide with the ui barrel? | verify | Re-verified (corrected by preflight PF-001): `at`/`center`/`cover` are free in `packages/ui/src/view/index.ts`. `fill` is **NOT** free — the immutable packaging oracle asserts `ui.fill === undefined`, and the `Flex` type already carries a `fill` field (grow:1) — so the standalone builder is named **`cover`** (AR-4). No collision on the chosen names. | ✅ Resolved (revised — PF-001) |
| AR-13 | Docs | JSDoc `@example` + `check:docs` obligation for new exports | required | Every new public export (`at`, `cover`, `center`, plus the extended `grow`/`fixed`/`Placement`) carries a copy-pasteable `@example`; `check-jsdoc.mjs` must stay green. No banned refs / no plan-ID leakage into shipped code. | ✅ Resolved |

**Gate statement:** every row is `✅ Resolved` with an explicit decision; zero deferred *within
this plan's scope* (S6/S8 are a scoped-out decision, AR-1, not an unresolved item). **✅ GATE PASSED.**
