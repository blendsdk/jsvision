# Preflight Report — layout-dsl

> **Feature**: jsvision-ui · **Plan**: layout-dsl · **CodeOps Skills Version**: 3.3.2
> **Scanned**: 2026-07-08 · **Scanner**: preflight (13-dimension, codebase-grounded)
> **Artifact**: `codeops/features/jsvision-ui/plans/layout-dsl/` (8 docs)
> ⚠️ **Independence note**: the plan was authored the same day (2026-07-08), likely by the same
> model family (Opus). This scan ran in a fresh, cleared context; standard-citation and
> adversarial-checklist safeguards were applied. Advisor cross-check was unavailable this session.

## Verdict

**✅ PREFLIGHT PASSED — all 5 findings resolved** (user decisions applied 2026-07-08).

- **PF-001 (MAJOR)** → RESOLVED: module relocated to `packages/ui/src/view/dsl.ts`, re-exported
  through `view/index.ts`; engine `position:'fill'` stays in `layout/`. (AR-5 revised.)
- **PF-002 (MINOR)** → RESOLVED: the standalone `fill(view)` helper is dropped (redundant with
  `grow(view)`, name-collides with the engine mode); `fill` remains a `Flex` prop + engine value.
  (AR-12, FR-2, ST-7, ST-16 revised.)
- **PF-003 (MINOR)** → RESOLVED: verify wording corrected — `yarn verify` already runs
  `lint + typecheck + build + test + check:docs`. (AR-10, 00-index, 07, 99 revised.)
- **PF-004 (MINOR)** → RESOLVED: ephemeral-prototype references neutralized; 03-01/03-02 are the
  self-contained source of truth. (02-current-state, register header revised.)
- **PF-005 (OBSERVATION)** → HARDENED into the plan: corner-settle recompute is change-gated
  (convergence guaranteed, asserted by ST-13); the centering-padding caveat is documented.

_Original scan verdict was **❌ BLOCKED — 1 MAJOR** before the fixes below were applied._

The plan is unusually well-grounded: **every `file:line` reference verified accurate** against the
current code, the ST oracles trace correctly to the engine behavior, and the "resizes for free"
claim is confirmed (reflow re-solves from the live tree). The findings are about **module
placement**, an **internal naming collision**, and two **stale-fact / traceability** issues — not
about the layout math, which is sound.

## Codebase Context Summary

- **Layering (verified):** `layout/` is the foundational engine with **zero** runtime dependency on
  `view/`; `view/` imports `layout/` (6 files). The direction is strict: view → layout, never the
  reverse.
- **Engine seam for `fill` (verified):** `layout.ts:88` splits flow vs `position!=='absolute'`;
  `placeAbsolute` (`:120-130`) offsets by the content origin and recurses; `measure.ts:50` excludes
  absolute from intrinsic size. The plan's FR-7 changes slot cleanly into exactly these three sites.
- **Lag-free resize (verified):** `reflow.ts:28-34` re-solves the whole tree each pass and
  `applyCentering` (`:47-60`) re-centers in the same pass; `render-root` flush runs reflow+recompose.
- **`at()` collision (verified):** `packages/examples/kitchen-sink/story.ts:69` exports
  `at(view,x,y,w,h)` (absolute pixel placement) — AR-3's rename to `place` is justified.
- **`yarn verify` (verified, contradicts the plan):** root `package.json` →
  `"verify": "yarn lint && turbo run typecheck build test check:docs"`. It already runs lint,
  per-package typecheck, and check:docs.

## Findings

### 🟠 PF-001 (MAJOR) — Placing `dsl.ts` in `layout/` inverts the layout→view layering and risks a circular import

**Dimension:** 13 Codebase Alignment (Architecture Mismatch / Dependency Reality).

`dsl.ts` must construct and subclass view types — `new Group()`, `class Stack extends Group`,
`class Empty extends View` (03-01) — and reference `ThemeRoleName` for `background`. All three are
**value** exports of `view/` (`view/view.ts`, `view/group.ts`, `view/types.ts`). AR-5 places the
module at `packages/ui/src/layout/dsl.ts` and re-exports it through `layout/index.ts`.

Verified consequences:

1. **Layering inversion.** `layout/` has zero runtime dependency on `view/` today. Re-exporting
   `dsl` from `layout/index.ts` makes the foundational engine runtime-depend on the entire view
   layer (View → reactive, Group, theme). Anyone importing just the layout engine now drags in the
   widget tree.
2. **Circular-import hazard.** If `dsl.ts` imports from the view **barrel** (`../view/index.js`),
   that barrel pulls `reflow.ts`, which has a **value** import `{ layout } from '../layout/index.js'`
   — producing the cycle `layout/index → dsl → view/index → reflow → layout/index`. Because
   `class Stack extends Group` evaluates at module load, this is a TDZ/load-order footgun
   ("Cannot access 'Group' before initialization" depending on re-export order). Importing specific
   view files (`../view/group.js`, `../view/view.js` — which only *type*-import layout) avoids the
   hard cycle, but the plan is silent on this and a naive import would trip it.
3. **Contradicts documented design.** `layout/index.ts`'s own JSDoc frames it as the pure
   cell-native engine whose "internal helpers stay module-private"; the CLAUDE.md structure note
   describes `layout/` as the engine with no view concern.

**Recommendation:** relocate the builders to **`packages/ui/src/view/dsl.ts`**, re-exported through
`view/index.ts` → `src/index.ts`. `view/` already imports `layout/` (adds no new cross-layer edge),
already owns `Group`/`View`/`ThemeRoleName`, and sits above the engine — no inversion, no cycle. The
engine change (FR-7, `position:'fill'`) stays in `layout/` where it belongs. (A dedicated top-level
`src/dsl/` is a viable alternative but adds a barrel for one file.) **Confidence: high** — the
value-import of `Group`/`View` into `layout/` is unavoidable and confirmed by grep.
**Hardening:** in-context adversarial check applied (advisor unavailable); the "import specific
files to dodge the cycle" escape hatch was considered and rejected as fragile vs. correct placement.

### 🟡 PF-002 (MINOR) — `fill` means three different things; `fill(view)` is redundant with `grow(view)`

**Dimension:** 1 Ambiguity / 12 Consistency.

The public surface uses `fill` three ways: (a) `fill(view)` builder → `grow(view, 1)` (a **flow**
`fr:1` child, FR-2); (b) `col({ fill: true })` prop → `fr:1` (FR-3); (c) engine `position:'fill'`
→ full-content-box **overlay** (FR-7), which `stack()` uses internally. A reader of `fill(myView)`
inside a `col` may reasonably expect the overlay meaning (it shares the engine mode's name and is
what `stack` fills with) but gets flow-grow. AR-3 disambiguated the `at`/`place` clash but this
internal one is unaddressed. Note `fill(view)` is also **exactly** `grow(view)` (grow already
defaults `n=1`) — redundant sugar. For a feature whose entire purpose is DX clarity, shipping a
tri-meaning verb is a self-inflicted footgun.

**Recommendation:** drop the `fill(view)` helper (keep the `{ fill: true }` container prop and the
engine `position:'fill'`), or rename the helper (e.g. `flex(view, n)`). Update FR-2 and the ST-7 /
ST-16 export list accordingly. **Confidence: high.**

### 🟡 PF-003 (MINOR) — Stale characterization of `yarn verify` (already runs lint + typecheck + check:docs)

**Dimension:** 13 Codebase Alignment (Stale Assumptions).

00-index, AR-10, 07, and 99 present `yarn lint`, per-package `typecheck`, and `check:docs` as steps
**separate from and beyond** `yarn verify`. The actual root script is
`"verify": "yarn lint && turbo run typecheck build test check:docs"` — verify already runs all
three. The instruction is redundant, not missing (no risk of an escaped defect), but the plan's
verify story rests on an outdated fact — the same staleness lives in `CLAUDE.md` ("verify = turbo
run typecheck build test") and in an auto-memory note. AR-10's *substantive* point (vitest doesn't
type-check `test/`, so spec oracles must assert runtime behavior) remains **correct**.

**Recommendation:** correct the characterization to "`yarn verify` already runs lint + typecheck +
build + test + check:docs"; keep the runtime-oracle guidance. Optionally flag the stale CLAUDE.md
line + memory for a separate refresh. **Confidence: high.**

### 🟡 PF-004 (MINOR) — The register derives AR-5…AR-13 from a prototype that no longer exists

**Dimension:** 13 Codebase Alignment (Phantom Reference) / 4 Completeness.

The Ambiguity Register (header + AR-5…AR-13) and 02-current-state cite `scratchpad/layout-dsl.ts` as
the user-approved source of truth ("inherited verbatim from the prototype"). That file is **absent**
(`find` across the repo returns nothing — the session scratchpad is ephemeral). The design itself is
fully transcribed into 03-01/03-02, so the plan is **implementable without it**; the issue is (a)
the register's provenance is now unverifiable, and (b) 02-current-state's instruction to "swap the
prototype's self-correcting fill for the engine `fill` mode" (`:52-54`) points at nothing.

**Recommendation:** neutralize the prototype references — restate AR-5…AR-13's rationale as
self-contained design decisions (they already are, in 03-01) and drop the "swap the prototype"
phrasing from 02-current-state. No design change. **Confidence: high.**

### 🔵 PF-005 (OBSERVATION) — Centering ignores parent padding; corner-settle must be change-gated

**Dimension:** 9 Edge Cases.

Two small robustness notes on the `stack` placement paths, neither blocking:

- `applyCentering` (`reflow.ts:50`) centers against `parent.bounds` (the parent's **full** rect),
  not its content box — a `stack` with `padding` would mis-center a `centered` layer by the padding.
  The ST-12 oracle uses no padding, and this matches the existing `Dialog` centering behavior, so
  it's consistent, not a regression. Worth a one-line doc caveat.
- The corner/edge self-correct path (03-01) calls `invalidateLayout()` from `Stack.draw`. It **must**
  compare the recomputed rect and no-op when unchanged (the plan says "on change") — otherwise a
  rect that never settles (e.g. from rounding) would spin reflow→draw→reflow. The ST-13 oracle should
  assert convergence (a second flush produces no further change), which it implicitly does.

**Recommendation:** add the padding caveat to the `centered`/`stack` JSDoc; ensure the ST-13 impl
test asserts idempotence after settle. **Confidence: medium.**

## Dimension pass summary

| # | Dimension | Result |
|---|-----------|--------|
| 1 | Ambiguities | PF-002 |
| 2 | Implicit Assumptions | clean (prototype-derived decisions are explicit) |
| 3 | Logical Contradictions | clean |
| 4 | Completeness Gaps | PF-004 (provenance) |
| 5 | Dependency Issues | PF-001 |
| 6 | Feasibility | clean (engine change is a 3-site additive edit) |
| 7 | Testability | clean (ST-1…ST-17 are runtime/behavioral, per AR-10) |
| 8 | Security | n/a (pure layout sugar; sanitize boundary untouched) |
| 9 | Edge Cases | PF-005 |
| 10 | Scope Creep | clean (migration + grid + JSX explicitly out of scope) |
| 11 | Ordering/Sequencing | clean (engine → builders → overlays → docs; spec-first) |
| 12 | Consistency | PF-002 |
| 13 | Codebase Alignment | PF-001, PF-003, PF-004 |

## What's verified solid

- All `file:line` references accurate (layout.ts:88, measure.ts:50, placeAbsolute:120-130,
  view.ts:65/69/86, reflow.ts:47-60, story.ts:69, DX-ASSESSMENT.md resolves).
- FR-7 fits the exact three engine sites the plan names; additive, existing `flow`/`absolute`
  behavior untouched.
- Resize-for-free claim confirmed against `reflow` + `render-root`.
- Kitchen-sink obligation (AR-11/FR-11) and JSDoc/`@example` obligation (FR-10) both present.
- No symbol collisions for `Flex`/`Placement`/`Stack`/`dsl` in the current tree.
