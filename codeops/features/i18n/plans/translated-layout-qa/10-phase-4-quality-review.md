# Phase 4 quality review

> **Status**: Reviewer and API-surface auditor accepted; no unresolved critical or major findings
> **Reviewed**: 2026-07-26 16:11 UTC
> **Authority**: AI — delegated by `--auto-design`
> **Policy version**: 1
> **Root invocation ID**: i18n-layout-qa-2026-07-26

## Review result

The independent correctness reviewer and API-surface auditor inspected the complete Phase 4
worktree. Their major findings converged on constrained Theme Designer geometry. Every finding was
fixed, and the single permitted re-review accepted the corrections with no unresolved critical or
major issue.

| ID | Severity | Finding | Ruling | Evidence |
|---|---|---|---|---|
| RV-001 / PA-001 | Major | The localized Theme Designer measured translated actions but centered them against the unclamped width and did not wrap them at feasible constrained viewports | Fix | Resolved content dimensions select one-row or vertical composition, size the dialog for the resulting metrics, and drive placement; a real 30×24 Dutch geometry test proves containment |
| RV-002 | Minor | The public Button snippet referenced an undeclared dialog and confused content metrics with outer dialog dimensions | Fix | The self-contained example constructs the Dialog, adds its chrome to outer dimensions, and labels metrics as content-area minima |
| PA-002 | Minor | Guidance described wrapped rows as equal even though only Button widths are equal | Fix | Consumer, canonical, and generated wording now says equal-width Buttons across multiple rows |
| PA-003 | Minor | The i18n impact seam omitted the package manifest that owns the documented `demo:i18n` command | Fix | `packages/examples/package.json` is mapped and the impact snapshot/plugin output was regenerated |
| RV-003 | Minor | Pre-existing Theme Designer help/list rectangles still use the preferred-width constant | Report | Outside the translated action-group correction; it does not invalidate the reviewed Button geometry or acceptance criteria |

## Delegated resolution

- **Eligibility**: Internal documentation-example geometry, test coverage, wording precision, and
  generated-plugin routing within the approved translated-layout behavior.
- **Objective**: Make the localized worked example demonstrate the same viewport negotiation it
  teaches, while keeping the canonical and generated SDK guidance reproducible.
- **Decision**: Derive action placement from resolved dialog content dimensions, wrap the complete
  group to one column only when the row cannot fit, grow feasible dialog height from the shared
  metrics, and prove containment through a real implementation test.
- **Evidence**: Button-group metrics are the public geometry authority; Dialog chrome consumes
  cells outside its content box; the original constant-width placement clipped Dutch actions at
  otherwise feasible widths.
- **Rejected alternatives**: Centering against the preferred width ignores actual viewport
  negotiation. Regex-only guidance tests cannot prove real geometry. Hand-editing the distributed
  plugin would break its generated-source contract.
- **Strongest counterargument**: The example still uses preferred-width rectangles for its
  non-action content. Those rectangles predate this phase's action migration and do not alter the
  shared Button metrics, containment assertion, or documented hard-bound behavior.
- **Confidence**: High — the independent re-review accepted every correction, focused and package
  suites pass, generated parity passes, and the authoritative full gate is green.
- **Hardening**: The reviewer independently reran the implementation and immutable documentation
  cases; the API auditor separately confirmed public claims, impact routing, and generated parity.
- **Reopen triggers**: Action metrics stop using resolved content dimensions, a feasible translated
  group clips, consumer/canonical/generated guidance diverges, plugin routing loses the command
  manifest, or the full gate fails.

## Verification

| Scope | Result |
|---|---|
| Focused documentation and canonical skill | 12 tests passed |
| Docs-site package | Typecheck passed; 26 files and 102 tests passed |
| Examples package | Typecheck passed; 47 files and 376 tests passed |
| Locale generation | 50 explicit entry points updated and check-clean |
| Documentation/plugin | `yarn docs:api`, `yarn plugin:update`, and `yarn plugin:check` passed |
| Translation review | Complete for 45 package/locale pairs using disclosed AI-assisted evidence; no human proficiency claimed |
| Full gate | `yarn verify` passed after the review fixes in 101.78 seconds |

## Post-review visual correction

A manual run in a terminal larger than 80×24 exposed that the interactive command still passed the
headless baseline viewport into `createApplication`. The first frame therefore occupied only an
80×24 region even when the real TTY was larger.

The interactive entry point now reads the current TTY columns and rows for every reconstruction.
The supervisor accepts a validated viewport, preserves the active viewport across its transition
API, and retains 80×24 only as the deterministic headless fallback. An implementation test proves a
111×37 session and its reconstructed successor both remain 111×37. A real 120×35 PTY smoke filled
the complete shell and exited normally through Alt+Q.
