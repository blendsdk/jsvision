# Preflight Report — View/Group Spine (RD-03 plan)

> **Artifact**: `plans/view-group-spine/` (implementation plan, 10 docs)
> **Type**: Implementation plan
> **Implements**: RD-03 (View/Group Spine + DrawContext + Theming)
> **Reviewed**: 2026-06-29
> **CodeOps Skills Version**: 3.0.0
> **Outcome**: ✅ **PASSED** — 1 MAJOR + 2 MINOR resolved into the plan; 1 OBSERVATION recorded.
> No CRITICAL. The plan is feasible, well-sequenced, and accurately grounded in the real code.
> All fixes applied 2026-06-29 (user approved the recommendations). Ready for `exec_plan`.

> **Reviewer note**: The plan was authored in a prior session (committed as WIP before this
> maintenance session), so this is **not** a same-session self-review — independence is
> reasonable. All codebase claims below were re-verified against the actual source.

---

## Codebase Context Summary

The plan builds **additively** on three landed subsystems. Every `file:line` reference in the
plan docs was checked against the real code and is **accurate**:

| Plan claim | Verified against | Result |
|---|---|---|
| `createRoot` nests under the *ambient* owner; imperative `new View()` has no parent scope | `reactive/owner.ts:49,63-70` (`createChildScope()` reads `getOwner()`) | ✅ exact — motivates `runWithOwner` (PA-1/AR-43) |
| `getOwner`/`setOwner` are module-exported but **not** on the reactive barrel | `reactive/scheduler.ts:41,52`; `reactive/index.ts` (absent) | ✅ exact |
| `Owner` is an internal disposal-tree node | `reactive/types.ts:134` | ✅ exact |
| `effect`/`dispose`/`onCleanup` | `effect.ts:20`, `owner.ts:104`, `owner.ts:82` | ✅ exact |
| `Show<N>(when, then, else?)` / `For<T,N>(each, key, render)` | `show.ts:24`, `for.ts:43-48` | ✅ exact (render returns `N`) |
| `ScreenBuffer` ctor `(w,h,fill: Style & {char?})`; `cells: protected readonly Cell[]`; `.text()` runs `sanitize`; `inBounds` drop | `render/buffer.ts:49,39,159,61` | ✅ exact — `clone()` can read protected `cells` |
| `serialize(current, previous\|null, {caps})`; `caps` required | `render/serialize.ts:64,32` | ✅ exact |
| `Style = {fg,bg,attrs?}`; `ThemeRole = {fg,bg,hotkey?}` (+`border`/`title`/`pattern`); 9 roles | `render/types.ts:54`, `color/theme.ts:17-52` | ✅ exact — PA-6 adapter correct |
| `Logger`/`createLogger`/`CapabilityProfile`/`TuiError`/`charWidth`/`sanitize`/`Attr` on core barrel | `engine/index.ts:19,55-58,104-115` | ✅ all exported |
| `Rect`/`Size2D`/`Padding`/`LayoutProps`/`LayoutBox` re-exported from `@jsvision/ui` | `ui/src/index.ts:24-32` | ✅ exact |
| RD-03 preflight report (PASSED, AR-43…AR-46) | `requirements/00-preflight-report.md:151-213` | ✅ exists, accurate |

**Reflow ↔ RD-02 fit**: `layout(root, viewport)` is pure `(LayoutBox, Size2D) → Map<LayoutBox,
Rect>` with the "fresh tree, distinct instances" precondition — PA-7's fresh-box-tree-per-pass
satisfies it by construction. **`export *` note**: the `@jsvision/ui` barrel re-exports reactive
via `export * from './reactive/index.js'`, so adding `runWithOwner`/`getOwner`/`Owner` to
`reactive/index.ts` (PA-1) automatically surfaces them through `@jsvision/ui` (ST-18). ✅

---

## Findings

| PF | Severity | Dimension | Summary | Resolution |
|----|----------|-----------|---------|------------|
| PF-001 | 🟠 MAJOR | Completeness / Codebase Alignment | No public API to hand a `Show`/`For` **producer** to a `Group` — `add(child: View)` only accepts a `View`; AC-12/ST-12 depend on it | ✅ **Resolved** — added `Group.addDynamic(producer)` (03-02 §addDynamic + class block, 03-04 dynamic-children, 01-requirements Group bullet, T7.3) |
| PF-002 | 🟡 MINOR | Codebase Alignment (signature) | `logger.error('view.draw threw', e)` (03-04) doesn't match the real `Logger.error(component, msg, fields?)` signature | ✅ **Resolved** — corrected to `logger.error('view', 'draw() threw', { error: String(e) })` (03-04) |
| PF-003 | 🟡 MINOR | Consistency / Ambiguity | Success criterion #6 uses bare "**RD-04**" to mean *foundation* RD-04 (core render); in jsvision-ui RD-04 = event loop (`rdIdScope: per-feature`) | ✅ **Resolved** — reworded DoD #6 to "RD-01 (reactive) or core's render-engine" (01-requirements) |
| PF-004 | 🔵 OBSERVATION | Edge Cases | Partial recompose assumes non-overlapping siblings; a latent limitation when RD-05 windows overlap | ✅ **Recorded** — non-overlap-assumption note added to 03-04 partial-recompose bullet |

---

### PF-001 🟠 MAJOR — Dynamic-children producer has no registration API

**Where**: `03-02-view-group-tree.md` (`Group` API), `03-04-reflow-scheduler-render-root.md`
§"Dynamic children", RD-03 §Public API surface, AC-12 / ST-12.

**Problem**: `Group` exposes `children: View[]`, `add(child: View)`, `remove(child)`. A `Show`
producer is `() => View | undefined` and a `For` producer is `() => View[]` (verified:
`show.ts:24`, `for.ts:43`) — **neither is a `View`**, so `add()` cannot take one. 03-04 says "a
Group accepts reactive child producers" and "runs a child-reconcile effect under its own scope,"
but **no method is defined** to pass the producer in. AC-12 ("Show/For mount/unmount view
subtrees in a Group") and Phase 7 / T7.3 depend on an API the plan never specifies — the
implementer would have to invent it, exactly the kind of gap preflight exists to catch.

**Recommendation** — add an explicit `Group.addDynamic(producer)` method:
```ts
addDynamic(producer: (() => View | undefined) | (() => View[])): void;
```
At add-time (or deferred to mount like `add`), create the reconcile `effect` under the group's
scope via `runWithOwner(this.scope, () => effect(...))` — exactly the machinery 03-04 already
describes — diffing the produced `View[]` against mounted dynamic children (`mountView`/`remove`)
and scheduling a reflow on change. Grounds cleanly in the existing `add`/`mountView` seam
(`03-02`); define it in 03-02's `Group` block, the RD/plan public surface, the `view/index.ts`
barrel list, and ST-18's import set.

*Considered and dropped*: overloading `add(child | producer)` — viable, but a separate
`addDynamic` keeps the static `View[]` path and the reactive path type-distinct and readable
(matches the disciplined-hybrid "structure changes go through Show/For" framing). The user may
prefer the overload; either resolves the gap.

---

### PF-002 🟡 MINOR — Draw-error log call doesn't match `Logger.error`

**Where**: `03-04-reflow-scheduler-render-root.md` compose-walker pseudocode:
`catch (e) { logger.error('view.draw threw', e); return; }`.

**Problem**: The real signature is `error(component: string, msg: string, fields?:
Record<string, unknown>): void` (`safety/logger.ts:66-72`). The plan's call passes the message as
`component` and an `Error` object as `msg` (which expects a `string`) — a type error under
`strict`, and the wrong field shape. The plan is otherwise meticulous about API grounding, so an
implementer copying this line hits friction.

**Recommendation**: correct the illustrative call to the real shape, e.g.
`logger.error('view', 'draw() threw', { error: String(e) })`. Also note for ST-14: the cleanest
**real-object** assertion (no mock) is to inject `createLogger({ sink: 'ring' })` and assert via
`logger.entries()` that the error record was captured — consistent with the project's
"prefer real objects" testing standard.

---

### PF-003 🟡 MINOR — "RD-04" is overloaded across feature-sets

**Where**: `01-requirements.md` Success criterion #6 — "`runWithOwner` and `ScreenBuffer.clone()`
do not regress RD-01 / **RD-04** existing tests."

**Problem**: `ScreenBuffer.clone()` lands on core's **render engine**, which is **RD-04 of the
archived *foundation* feature-set**. But this plan lives under `jsvision-ui`, whose **RD-04 is the
event loop** (backlog, zero tests) — and the marker sets `rdIdScope: per-feature`. So in context
the bare token "RD-04" reads as the event loop, which has no tests to regress. The ambiguity
register PA-8 note qualifies it correctly ("core RD-04 (`render`)"); criterion #6 does not.

**Recommendation**: reword #6 to name the subsystem, not the cross-feature RD id, e.g.
"…do not regress RD-01 (reactive) **or core's render-engine** tests." Cheap, removes the
collision.

---

### PF-004 🔵 OBSERVATION — Partial recompose assumes non-overlapping siblings

**Where**: `00-ambiguity-register.md` PA-8, `03-04` §"flush()/partial recompose".

**Note**: Partial recompose redraws only a dirty view's subtree from its cached clip. This is
correct for RD-03's v1 because the reflow pass derives sibling rects from RD-02 flex layout, which
produces **non-overlapping** rects by construction — so a repaint never has to consider a sibling
drawn on top. Overlap only arises from deliberate `bounds` manipulation or **windows (RD-05)**.
When RD-05 introduces overlapping windows, a partial recompose of a view *behind* another window
will overpaint cells the front window owns; RD-05's window manager will need to recompose
front-to-back over the dirty region (or re-introduce the deferred occlusion/`exposed()` pass,
AR-34). No action for RD-03 — recording so RD-05 planning inherits the constraint. Worth a
one-line note in 03-04 ("partial recompose assumes non-overlapping siblings; overlap handling is
RD-05") and an impl-test acknowledging it.

---

## Dimension scan summary

All 13 dimensions scanned. **Clean**: Implicit Assumptions, Logical Contradictions, Dependency
Issues (both additive primitives are real, back-compatible, and spec-tested in their owning
subsystem), Feasibility, Testability (spec-first ST→AC 1:1; real `ScreenBuffer`+`serialize`, no
mocks; injected synchronous scheduler), Security Blind Spots (in-process/output-only analysis
accurate — `ScreenBuffer.text` already routes through `sanitize`), Scope Creep (tight RD-03/RD-04
boundary), Ordering & Sequencing (7 phases, foundation-first, primitives first). Findings
concentrated in **Completeness** (PF-001) and **Consistency** (PF-002, PF-003).

## Traceability

PF-001 ↔ AC-12 / ST-12 / AR-36 · PF-002 ↔ AC-14 / ST-14 / AR-42 · PF-003 ↔ DoD #6 / PA-1,PA-8 ·
PF-004 ↔ PA-8 / AR-34. This report is separate from `00-ambiguity-register.md` (creation-time
decisions); it is the post-creation safety net.
