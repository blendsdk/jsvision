# Phase 4 Quality Review

> **Phase baseline tree**: `b722c383e0419b28982020b86b519a696e24bcb7`
> **Verification before review**: `yarn verify` passed across 19 workspaces in 132.10 seconds.
> **Authority**: technical corrections selected under the user-delegated `--auto-design` policy.

## Findings and rulings

| ID | Severity | Finding | Ruling |
|---|---|---|---|
| RV-001 | Major | The Router push/back case observed the same Home state before and after two actions, allowing no-op navigation to pass. | Split Push and Back into independently rebuilt cases and require Detail/back-available after Push; harden the implementation test with an observed return from Detail. |
| RV-002 | Major | Several capabilities relied on self-reported feedback rather than target drawing, paint order, nested-window geometry/retention, or actual menu items. | Add rendered glyph/overlay assertions plus typed target-state probes for nested windows and MenuBar data; make implementation tests inspect the same owned objects. |
| RV-003 | Major | The Desktop and Window examples invoked the explicitly internal `Desktop.attachLoop` seam before their nested windows mounted. | Remove both internal calls; the demonstrated public activation, arrangement, zoom, and close-policy methods tolerate an unattached nested loop. |
| RV-004 | Minor | The page and decision record described a Lab menu while the example displays File. | Align the text with the real File title and its Alt+L accelerator. |

All findings are accepted technical fixes within the approved page/example contract. No risk is
waived, and no product behavior, compatibility promise, or documentation scope changes.

## Auto-design provenance

- **Eligibility:** Test-oracle strengthening, supported API use, and wording alignment are reversible
  implementation corrections inside the approved Phase 4 scope.
- **Objective:** Ensure every documented capability is proven through the real target state and
  every consumer example uses supported public APIs.
- **Decision:** Apply every reviewer recommendation, including the report-only wording correction.
- **Evidence:** The independent reviewer traced each weak oracle or internal call to exact contract,
  example, and SDK source lines.
- **Rejected alternatives:** Retaining feedback-only probes was rejected because regressions could
  stay green; wrapping `attachLoop` in a docs helper was rejected because the demonstrated behaviors
  do not require that seam; dismissing the wording mismatch was rejected as needless inconsistency.
- **Strongest counterargument:** Additional family probes make the runner more specialized. Their
  closed literal union and target-owned readers keep that complexity bounded and reusable for later
  application-shell cases.
- **Confidence:** High — fixes directly observe the previously unobserved target state.
- **Hardening:** One independent re-review is required on the fix diff.
- **Policy version:** 1.
- **Root invocation ID:** `component-documentation-system-2026-07-29`.
- **Reopen triggers:** A target probe no longer reflects public runtime state, or a supported nested
  Desktop host API is introduced and becomes necessary for the lesson.

## Closure

The one permitted re-review closed RV-001 through RV-004 and found no Critical or Major
regression. The strengthened application-family suite passes all 32 focused cases. The exact
reviewed state passed `yarn verify` across all 19 workspaces in 126 seconds
(`/tmp/tmp.uOFttzzbYL`).
