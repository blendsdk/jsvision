# Phase 5 Quality Review Findings

> **Phase**: 5 — Terminal UI and theme
> **Baseline tree**: `b856c83ad48a5772121e301995f8ea9ead6a9a34`
> **Review status**: Closed after final parent verification
> **Authority**: AI — delegated by `--auto-design`
> **Root invocation ID**: `AD-CODE-EDITOR-EXEC-20260724-05`
> **Policy version**: 1

All critical and major findings require correction. No finding is waived or dismissed.

| ID | Severity | Decision | Required correction |
|---|---|---|---|
| RV-001 | Major | Accept | Apply resolved semantic styles to actual terminal cells and cover rendered style changes. |
| RV-002 | Major | Accept | Compose real scrollbar and status views in `CodeEditorWindow`. |
| RV-003 | Major | Accept | Replace journey-only command behavior with controller state and LSP/host effects. |
| RV-004 | Major | Accept | Use grapheme/tab-aware caret mapping and explicit viewport offsets. |
| RV-005 | Major | Accept | Validate completion ranges and expose bounded assistance/focus state without whole-document replacement. |
| RV-006 | Major | Accept | Deep-copy/freeze theme leaves, enforce contrast, and preserve monochrome distinctions. |
| SA-001 | Major | Accept | Validate source/application/base theme objects by own data descriptors before reading. |
| SA-002 | Major | Accept | Snapshot themes at `setTheme`; never retain or stringify caller-owned objects. |
| SA-003 | Major | Accept | Allow only strict hex, ANSI-16, or `default` colors. |
| SA-004 | Major | Accept | Enforce total frame-cell ceilings and bounded signatures. |
| SA-005 | Major | Accept | Normalize, validate, clip, cap, and index presentation spans. |
| SA-006 | Major | Accept | Visualize C1 terminal controls as inert cells. |
| SA-007 | Major | Accept | Snapshot bounded completion/snippet values and reject accessors/invalid ranges. |
| SA-008 | Major | Accept | Contain hostile host callback failures and change focus only after authorized close. |
| PE-001 | Major | Accept | Project directly from indexed snapshots without whole-document split/prefix scans. |
| PE-002 | Major | Accept | Reject unrealistic dimensions and frame products before allocation. |
| PE-003 | Major | Accept | Replace per-cell linear span searches with bounded indexed lookup. |
| PE-004 | Major | Accept | Bound diagnostic history and coalesce/cap pending host effects. |
| PE-005 | Major | Accept | Search from the current selection with a one-result ceiling. |
| PE-006 | Minor | Report | Cache the theme fingerprint and compute bounded frame evidence incrementally. |

## Auto-design ruling

- **Eligibility**: Internal architecture, validation, performance, recovery, and testing mechanisms
  within the approved UI/theme behavior and immutable safety ceilings.
- **Objective**: A real terminal editor surface whose rendering, assistance, and hybrid themes
  remain responsive and safe under hostile input.
- **Decision**: Apply all concrete corrections, consolidate overlapping security/performance work,
  verify, then request the one permitted independent re-review.
- **Evidence**: The phase diff passed tests but several tests asserted metadata instead of mounted
  behavior; direct source inspection proved unbounded inputs, shallow copies, and missing UI
  composition.
- **Rejected alternatives**: Waiver is prohibited; narrowing the tests would violate the immutable
  oracle; deferring bounds or real rendering would leave approved acceptance criteria unmet.
- **Strongest counterargument**: Integrating every language/LSP facet in the view increases the
  controller surface and may overlap the next quality phase.
- **Confidence**: High — corrections reuse existing document, LSP, and JSVision UI contracts.
- **Hardening**: Independent correctness, security, and performance reviewers converged on the same
  boundary and rendering defects.
- **Reopen triggers**: Re-review rejection, failed hostile-input tests, missed latency ceilings, or
  evidence that JSVision's existing scroll/status composition cannot support the editor contract.

## Closure

The single permitted re-review accepted twelve correction groups and rejected RV-001, RV-004,
RV-006, SA-001, SA-002, and the combined SA-005/PE-003 group. No third review was requested.
The parent then closed those groups by wiring local/LSP semantic presentation into actual styled
drawing, aligning wide-grapheme projection with visual caret columns, enforcing role-wide contrast,
descriptor-validating application and direct themes while retaining the last valid theme, and
rejecting overlapping span sets before binary lookup. Focused typecheck, 139 package tests, API
documentation checks, and the final full repository verification provide closure evidence without
waiver.
