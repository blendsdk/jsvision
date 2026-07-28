# Phase E Quality Findings

**Baseline:** `f9da410d0e698e13ded35bcea030f56f4acf91f2`

**Review scope:** T-04.23 through T-04.27

## Ruling

Auto-design accepts every technical correction below. No Critical or Major finding is waived or
dismissed. The user explicitly approved both immutable specification corrections: capability
oracles now observe public transitions independently, and shared-session oracles inspect real peer
editors and exclusion outcomes.

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| RV-E-001 | Major | Inventory evidence mainly proved non-empty scenario frames and trusted self-reported booleans. | Added concrete actions and independent public-state, host-effect, geometry, and frame oracles. |
| RV-E-002 | Major | Live completion, formatting, and save could remain unanswered or timer-dependent. | Replaced the long-lived fixture with a bounded self-answering demo session covering every advertised method. |
| RV-E-003 / SA-E-003 | Major | The shared-session scene mounted one editor and hard-coded isolation claims. | Mounted two real editor/controller/coordinator stacks over one transport and derived peer-exclusion evidence. |
| RV-E-004 | Major | Implemented hover, signature, symbols, diagnostic detail, snippet, replace, navigation-back, close, and external-change controls were missing. | Added all controls to the exhaustive manifest, live menu, actions, and specification coverage. |
| RV-E-005 | Minor | The kitchen-sink hint named the wrong folding shortcut. | Corrected the hint to `Ctrl-[`. |
| PE-E-001 | Major | Shared evidence could respond before request activation and the headless journey ran twice. | Awaited both synchronization gates before requests and memoized headless journeys by scenario ID. |
| PE-E-002 | Minor | Fixture derivation and capability setup repeated avoidable work. | Memoized derived fixture state while returning detached reset values; made setup lazy, idempotent, and awaited. |
| SA-E-001 | Major | The live in-process fixture retained unbounded content-bearing protocol arrays. | Added a fixed-capacity method-only transport with bounded pending requests and no parameter retention. |
| SA-E-002 | Major | Host-event storage was mutable, unbounded, and exposed directly. | Added a 32-entry allowlisted event ring with immutable detached snapshots. |
| SA-E-004 | Major | Protocol visibility was asserted rather than derived. | Derived completion, diagnostics, navigation, formatting, and cancellation evidence from actual outcomes and mutations. |
| SA-E-005 | Major | Cleanup covered success paths and allowed late continuations. | Added `finally` cleanup, scenario disposal, lazy readiness, and disposed-state guards. |
| SA-E-006 | Major | E2E child output grew without an independent byte ceiling. | Added 64-kB stdout/stderr ceilings, single settlement, listener cleanup, and forced termination on violations. |
| SA-E-007 | Minor | Unknown scenario IDs and top-level errors could echo caller-controlled text. | Switched to constant unknown-ID and process-failure messages. |

## Verification before re-review

| Gate | Result |
| --- | --- |
| Phase E specifications and implementation regressions | PASS — 3 files, 13 tests |
| Standalone E2E | PASS — 22 files, 30 tests |
| Complete examples unit suite | PASS — 41 files, 321 tests |
| Complete Code Editor package | PASS — 45 files, 334 tests |

## Re-review

The single permitted re-review confirmed the original live-response, two-editor composition,
inventory completeness, shortcut, race, transport-retention, host-log, derived-evidence, E2E-bound,
and error-sanitization findings resolved. It identified the remaining and new cases below.

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| RV-E-001 | Major | Generic frame checks and aggregate fingerprints still allowed unrelated state to satisfy capability claims. | Every interactive action now names one declared observable; specifications independently read that observable, while static claims use capability-specific predicates. |
| RV-E-006 | Major | The secondary shared-session editor had no keyboard focus route. | Added `Ctrl+Tab`/menu peer focus switching, focus-aware action routing, and a shell-dispatched peer-isolation regression. |
| RV-E-007 | Minor | Scenario runtime exceeded the project file-size threshold. | Extracted the capability manifest, fixture derivation, event log, shared-session composition, catalog, journeys, and evidence into focused modules; `scenarios.ts` is below 700 lines. |
| RV-E-008 | Minor | New public demo-session and shared-window properties lacked entity-level documentation. | Added concise property documentation for every exported/public field. |
| SA-E-005 | Major | Cleanup could race parser readiness, retained callable WeakMap entries, and left journey resources on exceptional paths. | Added generation/disposal guards, lazy readiness settlement, map deletion, inert post-disposal actions, and `try/finally` journey cleanup. |
| SA-E-008 | Major | Throwing response, diagnostic, or state listeners could escape and interrupt cleanup. | Clear retained callbacks before disposal delivery and isolate every listener invocation; hostile-listener regressions prove later cleanup continues. |
| PE-E-002 | Minor | Capability evidence mounted one complete surface per inventory entry. | Grouped entries by scenario and reuse one initialized surface per scenario journey. |

Because CodeOps permits only one re-review, these accepted corrections are closed through focused
regressions, complete package gates, and the authoritative repository gate rather than another
review cycle.

## Final verification

| Gate | Result |
| --- | --- |
| Phase E capability, evidence, and implementation suites | PASS — 3 files, 15 tests |
| Standalone focused E2E | PASS — 2 files, 2 tests |
| Complete examples unit suite | PASS — 41 files, 322 tests |
| Complete Code Editor package | PASS — 45 files, 334 tests |
| Plugin integrity | PASS |
| Authoritative `yarn verify` | PASS — 34/34 tasks |
