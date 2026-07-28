# Phase 2 quality review

> **Status**: Re-review completed; residual fixes implemented
> **Reviewed**: 2026-07-26 13:30 UTC
> **Authority**: AI — delegated by `--auto-design`
> **Policy version**: 1
> **Root invocation ID**: translated-layout-qa-2026-07-26

## Review result

Two independent reviewers inspected the complete Phase 2 worktree. They reported no critical
findings. Duplicate reports were merged into five major findings and three minor findings.

| ID | Severity | Finding | Ruling | Evidence |
|---|---|---|---|---|
| RV-001 | Major | Calendar geometry omitted localized weekday widths and safe cell clipping | Fix | Weekdays now resolve before metrics, widen day cells, and clip only at complete display glyphs |
| RV-002 | Major | Calendar right arrows and Today could remain outside a hard-smaller assignment | Fix | Live assigned-width metrics now re-anchor drawing and hit zones; hard-width mouse oracle added |
| RV-003 | Major | Datagrid popup action pairs stayed horizontal after viewport clamping | Fix | Built-in popups select horizontal or stacked complete-group layout from the grid width |
| RV-004 | Major | Files migration omitted ChDir and incomplete FileDialog text minima | Fix | Both dialogs now measure actions, titles, field labels, metadata, padding, and content minima |
| RV-005 | Major | Generic overlay clamping resized caller-owned custom popups | Fix | Only views exposing reactive `desiredSize()` opt into viewport resizing; custom absolute sizes remain intact |
| RV-006 | Minor | Calendar docs described code-unit rather than display-cell width | Fix | Documentation now names `stringWidth` and display-cell semantics |
| RV-007 | Minor | Replace prompt could receive a negative origin in a short desktop | Fix | Both prompt coordinates are clamped to non-negative desktop-local bounds |
| RV-008 | Minor | Overlay disposal test did not prove the sizing effect stopped | Fix | The test mutates desired size after disposal and asserts the layout remains unchanged |
| RV-009 | Major | A translated AM/PM label could overwrite fixed-position time fields | Fix after re-review | The complete hour/minute/period run now anchors from the measured period width |
| RV-010 | Major | Shared frame title clipping and centering used code units while dialogs reserved too little title chrome | Fix after re-review | Frame clipping/centering now uses display cells and migrated dialogs consume the shared title minimum |

## Delegated resolution

- **Eligibility**: Internal layout, compatibility, and test mechanisms within the approved translated
  surface behavior; no product scope, acceptance criterion, or public breaking change was introduced.
- **Objective**: Keep every feasible translated action and Calendar affordance complete and reachable
  while preserving established custom-popup behavior.
- **Decision**: Complete the component-owned geometry paths and gate reactive overlay resizing on the
  existing `desiredSize()` opt-in contract.
- **Evidence**: The approved specifications require Calendar weekday/hit-zone handling, both Files
  dialogs, stable popup reflow, async re-clamping, and additive customization compatibility.
- **Rejected alternatives**: Waiving the findings would leave specified paths incomplete. Resizing all
  custom popups would contradict the immutable overlay contract. Adding generic flex wrapping would
  broaden core layout semantics beyond the approved component-owned policy.
- **Strongest counterargument**: A uniform clamp for every overlay is simpler, but it silently changes
  caller-owned absolute geometry and cannot satisfy compatibility without a breaking-contract decision.
- **Confidence**: High — focused oracles and complete affected-package suites pass.
- **Hardening**: Two independent reviewers converged on the initial gaps. The one permitted fix-diff
  re-review accepted Calendar, Datagrid, custom-popup, prompt, and lifecycle corrections, then found
  the residual Files time-run and shared frame-title paths recorded above. Both were fixed with focused
  regression oracles; the quality protocol forbids a third review.
- **Reopen triggers**: A fix-diff re-review rejection, any affected-package regression, plugin drift,
  or a failing full `yarn verify`.

## Verification

| Scope | Result |
|---|---|
| UI | 330 files, 1,929 tests passed |
| Forms | 24 files, 116 tests passed |
| Files | 36 files, 181 tests passed |
| Datagrid | 111 files, 709 tests passed |
| Focused translated/compatibility oracles | UI 17, Forms 3, Files 22, Datagrid 14 passed |
| Full gate | `yarn verify` passed in 246.67 seconds |
