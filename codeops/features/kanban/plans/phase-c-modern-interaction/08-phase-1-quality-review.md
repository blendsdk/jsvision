# Phase 1 Quality Review

> **Phase baseline**: `6ccbae33f8f9a387df2755f1606a93657e9aeec6`
> **Reviewed HEAD**: `32ef0479d80bcfda7fb52e666a107aba8e9d31ef`
> **Scope mode**: strict
> **Status**: RE-REVIEW PENDING — all accepted corrections verified locally

## Independent findings

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| RV-001 | Major | Quit-cascade modal closure bypasses the capture-loss boundary. | Accept; use one boundary-aware modal-end path for public and cascade closure and add quit-cascade capture coverage. | Corrected; re-review pending |
| RV-002 / RV-C001 | Major | Subtree unmount loss allows reentrant capture of a descendant before disposal completes. | Accept; keep the capture lifecycle boundary active through actual subtree disposal and reject teardown-time reacquisition. | Corrected; re-review pending |
| RV-003 / RV-C004 | Major | A throwing public unmount observer can skip scope disposal and retain the root. | Accept; contain and bounded-log observer/finalizer failure while guaranteeing disposal and remountability. | Corrected; re-review pending |
| PE-001 / RV-C002 | Major | Retained stale leases keep the former view and entire event loop alive through their closures. | Accept; use a detachable per-lease cell cleared by the central transition and add retained-lease evidence. | Corrected; re-review pending |
| RV-C003 | Major | Modal entry can continue after its capture-loss callback stops or disposes the loop. | Accept; revalidate lifecycle after loss, decline modal entry with `undefined`, and preserve deterministic modal-close settlement. | Corrected; re-review pending |
| RV-004 | Minor | Public examples can start gesture resources for a candidate already replaced reentrantly before acquisition returns. | Accept as a necessary contract correction; require `active()` before publishing state or starting resources. | Corrected; re-review pending |

## Review policy and ruling provenance

- **Dispatches**: independent phase reviewer, concurrency/lifecycle auditor, and performance/resource
  auditor ran in parallel against the complete phase diff.
- **Verification before review**: UI typecheck; 32 focused files / 201 tests; plugin update/check;
  and `yarn verify:local` passed.
- **Authority**: active `--auto-design` under root invocation `EP-PHASE-C-20260811T1042CEST`.
  Every finding is a necessary technical correction inside the approved backward-compatible capture
  prerequisite; no finding is waived and no product, scope, compatibility, or UX decision is added.
- **Next gate**: implement and verify all accepted corrections, follow-up commit and push, then run
  the one permitted fix-scoped re-review. Phase 2 remains blocked until no Critical/Major finding is
  open.

## Remediation verification

The correction gate passed UI typecheck and public JSDoc checks; 32 focused files with 210 tests;
plugin regeneration and integrity; `yarn verify:local`; and whitespace validation. The retained-lease,
teardown-reacquisition, quit-cascade, callback-driven modal lifecycle, and throwing
observer/finalizer regressions are included in that result.
