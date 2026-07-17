# Preflight Report: Split-Panes Follow-ups

> **Status**: ✅ PASSED — all findings resolved (2 findings: 0 critical, 0 major, 1 minor, 1 observation)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/split-panes/plans/split-panes-followups/`
> **Codebase Grounded**: ~20 source/test/script files examined, ~30 references verified (all mapped)
> **Last Updated**: 2026-07-17
> **Note**: Likely same-author artifact; reviewed in fresh context (post-`/clear`). Low stakes (TUI demo follow-ups; no security/compliance surface).

## Codebase Context Summary

**Tech Stack:** TypeScript ESM-only, yarn 1.x + Turborepo monorepo, zero runtime deps (`@jsvision/core` → `@jsvision/ui` → `@jsvision/examples`). Reactive `signal`/`bind`; `draw()` is not auto-tracked, so repaints on signal change require an explicit `onMount` bind.

**Architecture:** Class-per-widget. `SplitView extends Group implements SplitOwner`; the module-private `Splitter` reads its owner via the narrowed `SplitOwner` interface. Panes are `fr` tracks whose layout `SplitView` rewrites on every `sizes` write — the mechanism AR-6 relies on.

**Key Files Examined:**
- `packages/ui/src/split/splitter.ts` (SplitOwner 16-21, onMount bind 37-43, draw+`▓` 46-52)
- `packages/ui/src/split/split-view.ts` (options 52-78, splitter ctor 139, applyWeights 168, `import type { Signal }` only at 11)
- `packages/ui/src/list/{list-view,list-box}.ts`, `packages/ui/src/layout/types.ts:213` (`direction ?? 'row'`)
- `packages/examples/amiga-clock/main.ts` (fresh-instance/shared-signal pattern 96-123), `packages/ui/src/window/window.ts`
- `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (72×16 harness, buffer text-match, ST-26)
- `packages/ui/test/split.spec.test.ts` (`makeSplit`; ST-21 asserts `▓`) + `split.impl.test.ts` (`▓` at :137,:152)
- `scripts/check-jsdoc.mjs`, `scripts/plugin-sync.mjs` (`writeApiDocs`), `scripts/check-plugin.mjs`, root `package.json` verify chain

**High-value confirmations:**
- Backward compat holds: the shipped oracle already asserts `▓` (ST-21) and stays green because `grabMark` defaults `true` (AR-11 ✓).
- AR-6 direct-`ListBox`-child transformation is sound — replacing `ListView.layout` (`{direction:'row'}`) with `{size:fr}` preserves `[rows|bar]` because the engine defaults `direction` to `'row'` (`types.ts:213`). Only `size` differs; all other layout props default identically.
- `plugin:sync --fix` genuinely regenerates the drifting API reference (`writeApiDocs`); `gen-plugin-api.mjs` captures interface fields + class members, so `grabMark` does drift and regen is required; `check-plugin` runs in `verify`.
- Zero external impact: `SplitOwner`/`Splitter` are module-private; widening `SplitOwner` only requires `SplitView` to expose `grabMark` (it does). No catalog change (no new class).

## Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|----------|---------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 0 | — |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-001) | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-001 shared; PF-002) | 🟡 |
| 13 | Codebase Alignment | 1 (PF-001 shared — Test Impact) | 🟡 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 0 | — |
| MINOR | 1 | Resolved |
| OBSERVATION | 1 | Resolved |

---

### PF-001: Testing-strategy mount harness underspecified & diverges from the proven split harness 🟡 MINOR

**Dimension:** Testability / Consistency / Codebase Alignment (Test Impact)
**Location:** `07-testing-strategy.md` §"Grab-mark detection helper" + the ST-1…ST-7 setups
**Codebase Evidence:** `packages/ui/test/split.spec.test.ts:67-81` and `split.impl.test.ts` both mount via `createEventLoop` **and set `split.layout = { position:'absolute', rect }`**; every smoke test wraps its root with `at(view,0,0,W,H)` (`kitchen-sink.smoke.spec.test.ts:70,155`). `render-root.ts:270-278` reflows the root over the viewport but the root supplies its own geometry — nothing auto-fills it.

**The Problem:** The §helper mounted "the view over `createRenderRoot`, flush()" and the ST setups (`new SplitView({…}), mount 20×8`) never gave the split a rect. In this codebase a root with no absolute rect (or `position:'fill'`) collapses to `{0,0}` and paints nothing, so `hasGrabMark` returns false even against a correct implementation → false reds in the spec-first flow. It also introduced a third mount pattern where both existing split test files use `createEventLoop`.

**Resolution — Option A (accepted):** Reuse the shipped `makeSplit` harness pattern (`createEventLoop` + explicit `split.layout = { position:'absolute', rect }`) and scan the loop's buffer for `▓`. The §helper was rewritten accordingly.
**Confidence:** High. **Hardening:** grounded in the universal in-repo mount pattern (every split test + every story sets an explicit root rect); render-root reflow confirmed not to auto-fill.
**User Decision:** Resolved — User accepted recommendation: Option A. Fix applied to `07-testing-strategy.md`.

---

### PF-002: F6 overstated the `@example` gate (members don't need their own `@example`) 🔵 OBSERVATION

**Dimension:** Consistency (requirement text vs. gate + spec)
**Location:** `01-requirements.md` F6 vs. `03-01-grabmark-option.md`
**Codebase Evidence:** `scripts/check-jsdoc.mjs:16-17,161-185` — Check B requires `@example` only on exported **classes/functions**; interfaces and their fields / class properties are exempt. `SplitViewOptions` ships today with no `@example` and passes.

**The Problem:** Read literally, F6 implied the `grabMark?` field and `grabMark` property each need an `@example`, which the gate does not require and which 03-01 correctly does not do (the `@example` line is added to the `SplitView` class). Wording only — no behavior wrong.

**Resolution (accepted):** F6 reworded to state the `@example` lives on the `SplitView` class and the members carry descriptive JSDoc only (matching the gate + 03-01).
**User Decision:** Resolved — User accepted recommendation. Fix applied to `01-requirements.md`.

---

## Clean dimensions (no findings)

Ambiguities, Implicit Assumptions, Logical Contradictions, Completeness Gaps, Dependency Issues, Feasibility, Security, Edge Cases, Scope Creep, and Ordering all passed. Specifically verified clean: default-`true` backward-compat against the shipped `▓` assertions; the AR-6 direct-`ListBox`-child transformation; the `plugin:sync --fix` API-drift path; `check-plugin` barrel-coverage (no new class); the `preProcess` `g`-key precedent (`drill-down.story.ts`); and the zero external impact of widening the module-private `SplitOwner`.

## Outcome

✅ **PASSED** — all findings resolved. The plan is grounded and ready to execute.
