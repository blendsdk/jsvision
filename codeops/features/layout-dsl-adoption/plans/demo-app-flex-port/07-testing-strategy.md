# Testing Strategy: demo-app-flex-port

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Re-scoped**: 2026-07-20 (preflight — ST-3 split, evidence claims calibrated, suite list trimmed)

## Testing Overview

This plan is a **behaviour-preserving refactor of dev-only code that already has a regression net**.
That shapes the strategy: most of the verification budget goes to proving nothing changed, not to
authoring new oracles.

| Code type | Target |
|---|---|
| New behaviour (the re-exported `at()` contract) | Spec-tested — ST-1…ST-4 |
| The 411 converted call sites | The audit table + two showcase screen diffs + the unedited smoke suite |
| The four local placers | Existing `*.e2e.test.ts` + a before/after zero-diff per demo |

Permanent golden files were considered and rejected (AR-7): they would pin dev-only demos to
byte-exact output forever, which directly fights the Tier-3 follow-up plan that RD-01 FR-6 sanctions.

### Coverage adjustment (AR-7)

The standard numeric coverage targets are **not** applied to this plan. `@jsvision/examples` is
dev-only, never shipped, and already carries per-demo e2e suites; adding coverage to it measures
nothing a reader of the demo would notice. The substitute bar is: every touched file's existing suite
stays green and unedited, and every touched demo produces a zero diff.

### What the type-checker does and does not cover

`packages/examples/tsconfig.json` includes only `capability-probe`, `resize-demo`,
`keyboard-mouse-playground`, `chrome-bars-demo`, `recipes`, and `datagrid-showcase`. So the standing
`yarn verify` typechecks `datagrid-showcase/story.ts` and its ~111 call sites — and **nothing else
this plan touches**. `kitchen-sink/story.ts` + its ~300 sites, all four local-placer demos, and
`test/story-at.spec.test.ts` are typechecked only by the one-shot sweep in task 1.5.1
(`npx tsc --noEmit` with a temporary include over `kitchen-sink` + `test`, run from the scratchpad,
no committed config change). Any claim of the form "a compile error catches this" must point at that
sweep, not at the standing build.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from [03-01](03-01-shadow-retirement.md) and the Ambiguity Register — not from observed
> output. If one fails after implementation, the implementation is wrong.
>
> The in-code traceability comment for each test states the behaviour in plain language. It must
> never carry an `ST-`/`AR-` id or a planning path.

### The re-exported story `at()` (`packages/examples/test/story-at.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-1 | Import `at` from `kitchen-sink/story.js`; call `at(v, 1, 2, 3, 4)` on a fresh `Group` | `v.layout` equals `{ position: 'absolute', rect: { x: 1, y: 2, width: 3, height: 4 } }`, and the call returns the same `v` (identity) | 03-01 §Proposed Changes, AR-6 |
| ST-2 | A view already carrying `{ direction: 'col', padding: 1 }`; call `at(v, 0, 0, 10, 5)` | `direction` and `padding` are **preserved** alongside the new `position`/`rect`. This is the merge contract the retired shadow violated — it is the reason the swap is not a no-op | 03-01 §Delta A, AR-6 |
| ST-3a | Same as ST-1, but importing from `datagrid-showcase/story.js` | Identical to ST-1 — the two showcases expose one builder, not two | 03-01 §Overview, AR-6 |
| ST-3b | Same as ST-2, but importing from `datagrid-showcase/story.js` | Identical to ST-2 | 03-01 §Overview, AR-6 |
| ST-4 | A **mounted** view (a `ViewHost` double on `view.host` counting `markRelayout`); call `at(v, 0, 0, 4, 1)` | `markRelayout` is called exactly once. The retired shadow never requested a reflow, which was the silent-stale-layout footgun | 03-01 §Delta B, AR-6 |

> **⚠️ AUTHORING RULE:** expectations come from the spec above, not from running the code. **ST-2,
> ST-3b and ST-4 are expected to be RED** before the retirement lands — both shadow bodies are
> byte-identical replaces, so the merge assertion fails from *either* import site. **ST-1 and ST-3a
> pass both before and after**; they exist to pin the parts that must *not* change.
>
> ST-1 must use a bare `Group` (or a plain `View` subclass), whose base `layout` initializes to `{}`
> — a widget carrying default layout props would make the exact-equality assertion fail for reasons
> unrelated to `at()`.
>
> A `ViewHost` double for ST-4 needs only `markRepaint()` and `markRelayout()`, assigned as an inline
> literal to the public `view.host` field. Do **not** count scheduler frames instead — a frame
> counter cannot distinguish a reflow from a repaint, and telling them apart is the entire point of
> ST-4.

## Test Categories

### Specification Tests (from ST-cases above)

| Test File | ST Cases Covered | Component |
|---|---|---|
| `packages/examples/test/story-at.spec.test.ts` | ST-1, ST-2, ST-3a, ST-3b, ST-4 | Shadow retirement (03-01) |

### Implementation Tests

None. The retired helpers have no internals left to test — the implementation *is* a re-export of a
builder that `packages/ui/test/view-setlayout.spec.test.ts` and the dsl suites already cover. Adding
an impl tier here would test `@jsvision/ui` from the wrong package.

### Integration / regression tests (existing, unedited)

| Suite | Guards |
|---|---|
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | All 84 story files mount and paint — the only test reaching every one of the 411 call sites |
| `packages/examples/test/datagrid-showcase.smoke.spec.test.ts` · `.walkthrough.spec.test.ts` | The datagrid showcase's 111 call sites |
| `packages/examples/test/{wizard,themes,tabs}-demo.e2e.test.ts` | The three demos whose local placer is retired |

**Contract:** none of these files may appear in `git diff --name-only` at any point in this plan. A
failure in one of them means the conversion is wrong.

### What the smoke suite can and cannot prove

`kitchen-sink.smoke.spec.test.ts:42-46` asserts story metadata plus `paintedCells(...) > 0`. It
therefore catches a crash or a blank screen across all 84 story files, but **not** the
wrong-but-nonempty failure mode a replace→merge change produces — the very mode AR-7 cites when
rejecting smoke-only as sufficient. The Phase-1 evidence chain is consequently:

1. the audit table, complete, every surfaced row ruled (the primary control);
2. the kitchen-sink shell and datagrid-showcase walkthrough screens, zero-diff;
3. the smoke suite green and unedited.

An optional stronger form — loop the exported `STORIES`, mount each headlessly, hash the buffer
before and after — reuses the smoke test's own mount harness and can be run from the scratchpad if
the audit surfaces more than a handful of ⛔ rows.

### End-to-End verification — the buffer-diff protocol (AR-7)

| Scenario | Steps | Expected Result |
|---|---|---|
| Showcase render parity | (1) `yarn build`; (2) mount the kitchen-sink shell and the datagrid-showcase walkthrough headlessly at a fixed size, serialize the full screen to a scratch baseline; (3) apply the re-export; (4) `yarn build`; (5) re-serialize | Byte-identical. A non-zero diff blocks the task until explained and accepted per the 03-01 ⛔ rule |
| Per-demo render parity | The same, for `wizard-demo`, `themes-demo`, `tabs-demo` and the kitchen-sink `wizard` story — **baselines captured before task 1.4.1 edits any of them** | Byte-identical |

Baselines live in the session scratchpad, never in the repo — they are one-shot evidence, not
committed fixtures (AR-7). Both captures must be taken after a build, because examples tests import
the **built** `@jsvision/ui` dist and a stale dist silently invalidates the comparison.

## Test Data

### Fixtures Needed

None committed. The buffer baselines are scratch artifacts.

### Mock Requirements

One two-method `ViewHost` double for ST-4 (`markRepaint`, `markRelayout`), as an inline object
literal on `view.host`. Everything else uses real objects — real views, real layout solver, real
render root.

## Verification Checklist

- [ ] ST-1…ST-4 defined with concrete input/output pairs ✅ (above)
- [ ] Every ST case traces to 03-01 or an AR entry ✅
- [ ] Spec tests written BEFORE the retirement
- [ ] ST-2, ST-3b and ST-4 verified RED before the retirement; ST-1 and ST-3a green
- [ ] All five green after
- [ ] The one-shot `tsc --noEmit` sweep passes over `kitchen-sink` + `test`
- [ ] Zero existing test files edited
- [ ] Every touched demo's before/after diff recorded as zero (or explained)
- [ ] `yarn verify` green
