# Phase 7 review findings

> **Review baseline**: `4f022261ab19f90bda85a1e00538803fa10c8659`
> **Review status**: Closed after the one permitted re-review and final parent correction
> **Authority**: AI — delegated by `--auto-design`
> **Root invocation ID**: `AD-CODE-EDITOR-EXEC-20260724-07`

| ID | Severity | Decision | Resolution |
|---|---|---|---|
| RV-001 | Major | Fixed | Added a real `createApplication` shell with scenario list/menu commands, focused live editor, help/status, bound inspector, reset, and TTY execution while retaining the non-TTY walkthrough. |
| RV-002 | Major | Fixed after re-review | Live mounts now use viewport/capability context and configure real local analysis, LSP capabilities, diagnostics/completion, host recording, themes, terminal fallbacks, and size-mode inspection. The live action menu operates editing, search, folding, completion, formatting, save, navigation, and theme changes. |
| RV-003 | Major | Fixed after re-review | The independent spec author strengthened the oracle to 17 behavioral cases; implementation tests additionally drive live-shell actions, host inspection, focus, and resize, while E2E asserts real non-TTY journey evidence. |
| RV-004 | Major | Fixed | The global story now schedules real TypeScript analysis, publishes a simulated diagnostic through LSP, opens completion, binds state text, and documents keyboard plus mouse controls. |
| RV-005 | Major | Fixed | Release validation now creates and extracts a real tarball, links only existing installed dependencies, and imports the root plus all four subpaths by package name in a temporary consumer. It also found and closed a missing direct `@lezer/common` dependency. |
| RV-006 | Major | Fixed after re-review | The global story registers owner cleanup, guards late continuations, disposes editor/controller resources, closes the coordinator, and has a disposal/late-result regression test. |

The single permitted re-review closed RV-001, RV-004, and RV-005, rejected incomplete closure of
RV-002/RV-003, and identified RV-006. No third review was dispatched. Final parent correction wired
real language/LSP/theme/size configuration into live mounts, added an action menu and bound
inspection for live host effects, exercised live shell actions/focus/resize, and closed story
lifecycle ownership. The final focused and repository verification gates are the closing evidence.

All findings are eligible implementation corrections within the approved showcase and release
scope. No finding is waived or dismissed. The selected fixes maximize direct behavioral evidence
and reuse established JSVision application and package-validation boundaries. Rejected: weakening
facet claims or tests, because that would reduce approved acceptance behavior. Strongest
counterargument: a comprehensive live demo adds maintenance surface; the explicit registry,
shared deterministic journeys, and headless shell seams keep that cost bounded. Confidence: High.
Hardening: independent review found the gaps; one fix-scoped re-review is required after correction.
