# Phase 3 Quality Review

> **Phase baseline tree**: `3fb1d2ab3d93ce3ef553e58edd78ed3c43bf1c12`
> **Scope mode**: strict
> **Status**: COMPLETE — remediation and the single fix-scoped re-review are verified

## Independent findings

| ID | Severity | Finding | Auto-design ruling | Status |
|---|---|---|---|---|
| SA3-001 | Major | An adapter update can target a card other than the identity claimed by the session. | Accept; correlate edit proposals and resolved standard records to the exact type-sensitive session card key before authority dispatch. | Fixed and verified |
| SA3-002 | Major | Publications arriving before initial resolution accumulate without a bound. | Accept; retain only the latest authoritative publication and reconcile it after resolution. | Fixed and verified |
| SA3-003 | Major | Uncooperative validators, resolvers, reloads, or authority promises can keep package operations and coordinator claims pending after cancellation. | Accept; race every application await against its generation-owned abort signal and detach package continuations promptly. | Fixed and verified |
| SA3-004 | Major | Standard adapter options, summaries, and checklist collections are traversed before descriptor-safe bounds apply. | Accept; snapshot exact records and bounded arrays before iteration and normalize hostile failures to the public schema error. | Fixed and verified |
| RV3A-001 | Major | A stale/deleted publication during async validation can still be followed by authority dispatch. | Accept; abort and invalidate the active submit generation and return the authoritative record outcome. | Fixed and verified |
| RV3A-002 | Major | A matching publication arriving before authority acceptance is consumed as stale, leaving the accepted operation waiting forever. | Accept; buffer one dispatch-generation publication and reconcile it immediately when acceptance supplies the expected revision. | Fixed and verified |
| RV3A-003 | Major | Reentrant subscribers can deliver newer state and then an older snapshot to later listeners. | Accept; serialize/coalesce actor notifications and re-check subscription and disposal before each callback. | Fixed and verified |
| RV3A-005 | Major | Reload can run during dispatch or publication wait and silently abandon operation correlation. | Accept; allow reload only for stale records with no in-flight submission and return a typed sealed outcome otherwise. | Fixed and verified |
| RV3-001 | Major | Visibility, read-only, and malformed formatter failures can disappear before submission and permit dispatch. | Accept; retain presentation diagnostics independently and merge them into validation/focus gating. | Fixed and verified |
| RV3-002 | Major | Choice schemas permit duplicate identities and default parsing accepts values outside the declared domain. | Accept; reject duplicate choice IDs and enforce exact registered values for single/multiple choice unless an explicit parser owns custom semantics. | Fixed and verified |

## Review evidence

The entry gate passed Kanban build, typecheck, dependency and documentation checks; 32 focused editor,
security, package, and packed-consumer tests; 116 Forms tests; plugin synchronization/parity; and
`yarn verify:local`. Correctness, security, and API/concurrency reviewers then inspected the complete
phase baseline diff independently.

All findings are necessary corrections inside the confirmed editor-core scope. Auto-design accepted
each Major without waiver. The correction receives one fix-scoped re-review before Phase 4 begins.

## Remediation evidence

The correction adds focused race, cancellation, hostile-input, choice-domain, and callback-failure
coverage. Kanban build/typecheck/dependency/documentation checks, the focused editor and package suite,
116 Forms tests, plugin synchronization/parity, and `yarn verify:local` all pass. The implementation is
split into bounded actor, asynchronous-work, field, and notifier modules; no source file exceeds the
700-line ceiling.

## Fix-scoped re-review

Correctness and security found no remaining Critical or Major defect. The API/concurrency lens found one
remaining Major: proposal preparation exposed `dispatching` before authority invocation, allowing a
synchronous stale publication to be buffered while an obsolete request still escaped. Auto-design accepted
the correction without waiver. The actor now remains interruptible through proposal construction, re-checks
its generation afterward, and exposes `dispatching` only after authority invocation has begun. A red-then-green
regression test proves that a proposal callback publishing a newer revision emits no request and returns
`stale`.

The deterministic post-correction gate passes 47 focused Kanban tests, 116 Forms tests, Kanban build/typecheck/
dependency/documentation checks, plugin synchronization/parity, and `yarn verify:local`. Per policy, no third
review was run.
