# Phase 7 quality review: ordered events and application-owned history

> **Baseline:** `45f5b0643`
> **Initial reviewed head:** `3d1ab0e3d`
> **Remediated head:** `3509ac7b3`
> **Status:** PASSED AFTER REMEDIATION
> **Reviewed:** 2026-08-15 02:27 CEST

## Gate result

Independent correctness/API and security/lifecycle reviews found no Critical issue and four Major
issues. The user's standing `--auto-design` authority accepted every in-scope correction; no risk
was waived. The single permitted fix-scoped re-review reports PASS from both reviewers.

| ID | Consolidated Major finding | Decision | Status |
|---|---|---|---|
| P7-Q01 | Action invocations could execute for one board while their events inherited another hub's board identity | Expose the immutable hub board ID and reject mismatched invocations before policy, execution, or publication | Closed |
| P7-Q02 | One-for-one nested publication could run forever because instantaneous queue length never reached capacity | Bound cumulative nested admissions for each synchronous drain independently of queue length | Closed |
| P7-Q03 | Accessor options and rejected asynchronous callbacks could bypass subscriber/observation isolation | Descriptor-snapshot hub options and consume exact-native asynchronous callback rejection through captured Promise intrinsics | Closed |
| P7-Q04 | A proposal built for an old history revision could dispatch after current availability changed | Abort pending builders on revision replacement and recheck revision plus direction immediately before authority dispatch | Closed |

## Remediation evidence

| Finding | Implemented evidence | Verification |
|---|---|---|
| P7-Q01 | `KanbanEventHub.boardId` is immutable; router resolution rejects a different invocation board before emitting or executing | Action-event lifecycle specification |
| P7-Q02 | A drain admits at most its configured cumulative nested budget and emits one overflow observation | Event-hub implementation suite |
| P7-Q03 | Construction rejects accessor-bearing options; synchronous throws and exact-native Promise rejection remain isolated and redacted | Event-boundary specification and event-hub implementation suites |
| P7-Q04 | Valid revision changes abort all pending builders; stale or unavailable work returns a bounded rejection without dispatch | History specification and implementation suites |

Package evidence: Kanban build/typecheck/docs/dependencies, 128 functional files and 1,012 tests,
isolated performance oracle, and 8 E2E files with 37 passing and 2 intentional skips. Generated
plugin API references, `yarn plugin:check`, and `yarn verify:local` pass.

The fix-scoped correctness reviewer reran 14 focused tests and reported PASS. The security/lifecycle
auditor reran 18 focused tests plus typecheck and diff validation and reported PASS. No remaining
Critical or Major issue was found. Gate closed 2026-08-15 02:27 CEST.
