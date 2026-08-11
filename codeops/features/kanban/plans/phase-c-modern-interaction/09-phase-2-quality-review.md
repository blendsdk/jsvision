# Phase 2 Quality Review: Kanban Phase C Modern Interaction

> **Baseline**: `ce42d01f30d26519cebaae15e1a31a0b2b844509`
> **Scope**: Phase 2 request, placement, eligibility, and operation-ID contracts
> **Ruling**: Auto-design authorization accepted every technical correction without changing product scope

## Independent review result

Two independent read-only reviews covered general correctness/API design and hostile-input/security
behavior. No Critical finding was reported.

| Severity | Finding | Resolution |
|---|---|---|
| Major | Captured card, column, and swimlane entity revisions were not compared with current authority | Compare every captured entity before placement and policy evaluation; missing and stale entities now fail deterministically |
| Major | Moved-card source placement was retained but not checked for cursor, anchor, edge, or token currency | Add bounded per-source-cell evidence and re-evaluate every source interval before the destination interval |
| Major | Column and swimlane authority arrays used the much larger selected-card ceiling | Apply the manifest's `columns.safe` and `swimlanes.safe` limits |
| Major | Existing transition/WIP evaluator results were not accepted by the eligibility pipeline | Validate and map exact workflow `violation`, `label`, and `retryable` shapes into bounded eligibility metadata |
| Major | The required warning/destructive confirmation classifier was missing | Add the pure exported classifier for warnings and all five destructive proposal kinds |
| Major | Native Promise settlement could trigger an own `constructor`/species accessor | Reject same-realm Promises with any own member before intrinsic settlement |
| Major | Operation-ID options read hostile accessors/proxies directly | Descriptor-snapshot exact option keys and normalize all invalid representations |
| Major | The public placement-currency helper directly dereferenced hostile evidence | Exact-key snapshot and bound all evidence before evaluation |
| Minor | Capability and selection variants accepted members from another discriminator | Enforce exact per-variant member sets |
| Minor | The injected operation-ID factory ran even when active capacity was already full | Check disposal and capacity before invoking the factory |
| Minor | New request and eligibility members lacked sufficient public documentation | Add ownership, revision, bound, and semantic-purpose documentation |

## Fix-scoped re-review

The general reviewer closed all original findings and found no new or reopened Critical/Major issue. The
security reviewer closed all original findings, then identified one new Major interaction: individually
bounded source-cell evidence could multiply across too many cells.

That interaction is corrected with three nested ceilings:

- at most `retainedCursors.safe` source cells;
- at most `ensureRangeCards.safe` anchors per source cell; and
- at most `selectedKeys.safe` aggregate anchors plus tokens across all source cells.

A hostile compound-ceiling test proves rejection before policy evaluation. CodeOps permits one fix-scoped
re-review only; the final interaction correction therefore received local inspection and focused automated
verification rather than a second review round.

## Verification evidence

| Gate | Result |
|---|---|
| Kanban typecheck | PASS |
| Focused remediation tests | PASS — 3 files / 51 tests |
| Full Phase 2 focused suite | PASS — 6 files / 77 tests |
| Kanban build/typecheck and dependency/docs checks | PASS |
| Plugin update/check | PASS — generated API synchronized and integrity green |
| `yarn verify:local` | PASS — 15 changed files |

## Outcome

**PASS.** No known Critical or Major finding remains, every final gate is green, and the strict Phase 2
scope is preserved.
