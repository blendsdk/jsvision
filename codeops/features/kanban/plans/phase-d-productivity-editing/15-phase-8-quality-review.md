# Phase 8 quality review: board composition and permanent showcases

> **Baseline:** `a1fef1577`
> **Initial reviewed head:** `2266bb189`
> **Status:** REMEDIATION VERIFIED — FIX-SCOPED RE-REVIEW PENDING
> **Reviewed:** 2026-08-15 03:55 CEST

## Gate result

Independent correctness/API and performance/concurrency reviews found no Critical issue and six
Major issues. The standing `--auto-design` authority accepted every in-scope correction; no risk is
waived. The remediation now passes the complete Phase 8 package, example, plugin, and local gates.
Phase 9 remains blocked until the single permitted fix-scoped re-review passes.

| ID | Consolidated Major finding | Decision | Status |
|---|---|---|---|
| P8-Q01 | Final pointer drops bypass current action capability/event routing after grab admission | Route the contextual drop/move action through the current shared router immediately before authority commit and cover selective denial plus events | Remediated; re-review pending |
| P8-Q02 | F1/help reports handled without a presenter and prevents application fallback | Let unimplemented package help reach `executePackageAction`; assert the callback/visible outcome | Remediated; re-review pending |
| P8-Q03 | Editor/configuration modals and late callbacks can outlive story replacement | Add story-owned cancellation, make post-mount editor abort finish its modal, suppress stale writes, and test open→replace cleanup | Remediated; re-review pending |
| P8-Q04 | Four permanent stories mount but do not demonstrate the complete committed workflow inventory | Complete each story's named states/actions and add focused behavior evidence without widening beyond the existing story contract | Remediated; re-review pending |
| P8-Q05 | Performance harness hard-codes board/render counters and activates none of its ten registered filters | Instrument a mounted board/controller/render-root transaction, use all ten filters, and derive every budget counter from observed work | Remediated; re-review pending |

P8-Q03 consolidates RV-003 and PE-002. P8-Q05 is PE-001. P8-Q01, P8-Q02, and P8-Q04 are
RV-001, RV-002, and RV-004 respectively.

## Closure protocol

Add requirement-derived regressions before each implementation correction, confirm the relevant red
state, implement every accepted correction, run the complete Phase 8 focused and package gates, then
dispatch one fix-scoped correctness/performance re-review. Record the remediated head and final status
only after both reviewers report no remaining Critical or Major issue.

## Remediation verification

- Kanban build/typecheck, 1,024 functional tests with timing tests isolated, 40 runnable E2E tests,
  dependency checks, and documentation checks pass.
- Both isolated performance oracles pass, including the 2,000-card/10-active-filter median frame
  budget and the existing mixed-height projection/pointer benchmark.
- Examples typecheck, 459 unit tests, and 30 E2E tests pass after a fresh Kanban build.
- Generated plugin/API references are synchronized, `yarn plugin:check` passes, and
  `yarn verify:local` passes.
