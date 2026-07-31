# Phase 8 Quality Review

## Review context

- Baseline tree: `360c645f8d410764d81b34f73453b2034da1cd35`
- Reviewer: independent `preflight_fit` agent
- Commit mode: `--auto-commit`
- Design mode: `--auto-design`
- Pre-review verification: `yarn verify` passed in 134.08 seconds
- Security/performance audit: skipped because the phase changes documentation examples and tests
  without a security-sensitive or performance-sensitive plan tag

## Pass 1 findings and rulings

| ID | Severity | Finding | Auto-design ruling |
| --- | --- | --- | --- |
| RV-801 | Major | FormDialog validation, coercion, and cancellation were inferred from the teaching shell instead of the real modal. | Accepted: narrow preview contracts and add real invalid, coerced, async-sealed, rejection/retry, cleanup, cancellation, and reopen evidence. |
| RV-802 | Major | FileDialog, ChDirDialog, and DirList contracts claimed target behavior from direct signal/status writes. | Accepted: narrow preview contracts, perform real faulting filesystem operations, and add real modal browse/result/error oracles. |
| RV-803 | Major | The eight pages omitted option/default/interaction tables required by the component-page template. | Accepted: add concise source-backed configuration tables and public-state guidance to every page. |
| RV-804 | Major | FileDialog documentation incorrectly promised that the selected target itself is checked for readability. | Accepted: document the actual readable-parent contract, new-path behavior, and open-workflow responsibility. |
| RV-805 | Major | ChDirDialog documentation incorrectly promised that cancellation rolls back a caller-owned directory signal. | Accepted: distinguish `result() === null` from live shared-signal navigation and the opener's internal signal. |
| RV-806 | Minor | The confinement oracle omitted normalized traversal and prefix-collision paths. | Accepted: add both cases. |
| RV-807 | Minor | FileEditor persistence used a frame-wide probe and multiline status text could clip. | Accepted: use target modified-state plus bounded visible feedback; retain the direct exact filesystem/backup oracle. |

Ruling provenance: delegated by `--auto-design`; every correction is bounded to the verified Phase
8 behavior, documentation, fixture, and test scope. Findings were fixed rather than waived or
dismissed.

## Re-review

The single permitted re-review closed RV-802 through RV-807 and substantially reduced RV-801. It
confirmed that the corrected contracts no longer claim shell-owned behavior, every page contains
the required configuration depth, the two dialog semantics are accurate, and the hardened
filesystem/editor evidence is target-owned.

RV-801 retained one bounded residual: the docs-site oracle did not yet exercise a field-level async
validator, the close-box and quit branches of the submit seal, or observable form disposal after a
body-builder failure. Auto-design accepted the only viable correction because all three behaviors
are explicitly taught on the page. The final test now:

- blocks a taken name through `asyncValidators` before accepting a coerced result;
- sends re-OK, Cancel, Escape, close-box, and quit attempts through a pending submit and verifies the
  modal remains sealed; and
- proves body-failure disposal by changing a field after rejection and observing that its debounced
  async validator no longer runs.

The correction passed focused verification. Per the quality-profile cap, no third review was
dispatched; the residual was fixed rather than waived or dismissed.

## Verification evidence

- Corrected focused typecheck and specification/implementation validation: 46/46 passed.
- Complete docs-site unit suite: 506/506 passed.
- Documentation build and integrity gate: 20/20 passed.
- Post-review monorepo gate: `yarn verify` passed in 129.88 seconds.
