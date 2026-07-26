# Phase 3 quality review

> **Scope**: Phase 3 Application/UI foundation diff from baseline tree
> `86ff4ff35f7b842e7df1d29482aa8f1910cf865b`
>
> **Profile**: Strict defaults plus public API, security-boundary, and performance/compatibility
> review
>
> **Status**: PASS — the Major finding was corrected, verified, and re-reviewed once

## Findings and rulings

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-3-001 | Major | Accepted by auto-design | Remove the mutable module-global English fallback; create one private service per standalone widget/call and one shared private service per button pair |
| RV-3-002 | Minor | Fixed opportunistically | Correct all modal-helper host documentation to include `i18n` or recommend passing an Application |
| PE-3-001 | Minor | Fixed opportunistically | Resolve and cache all twelve localized month names when Calendar is constructed instead of recompiling one on every draw |
| SA-3-001 | Minor | Report-only; carry into scanner expansion | The conservative Phase 3 scanner does not yet classify dynamic expressions or distinguish duplicate occurrences; harden it when the Phase 4 package inventory expands |
| PE-3-002 | Minor | Report-only; covered by Phase 5 API work | Route re-exported i18n symbols to a dedicated generated API page instead of enlarging the general core-essentials page |

No reviewer reported a critical finding. No Major finding was waived or dismissed.

## Auto-design correction

The only viable correction for RV-3-001 was instance isolation. An immutable fallback facade would
have added a second service abstraction, while retaining a shared mutable `I18n` contradicted the
accepted application-ownership model. Standalone Calendar and Switch instances and individual
button factories now create private English services. Pair factories create one private service
for the pair, and hosted helpers continue to use the exact application service.

## Correction evidence

- A Calendar subclass mutates its protected service overlay, then a later standalone Calendar
  still renders the canonical English month. This reproduces and closes the original cross-instance
  leak.
- Calendar caches its localized month and weekday names at construction; redraw no longer compiles
  a default month message.
- Modal host JSDoc consistently documents `{ loop, desktop, i18n }` and Application usage.
- Focused correction tests and UI typecheck passed; generated plugin references and integrity checks
  passed.

## One-time fix re-review

The correctness reviewer confirmed RV-3-001 and RV-3-002 resolved. The module-global service is
gone, service sharing is limited to one intentionally constructed button pair, and the mutation
regression covers the reported leak. The reviewer found no new critical, major, or minor issue in
the correction.

## Final verification evidence

- UI specification and isolation correction suites passed.
- UI typecheck and plugin generation/integrity checks passed.
- Root `yarn verify` passed after correction: lint/formatting, literal inventory, all workspace
  builds/typechecks/tests/documentation checks, and Codex plugin integrity.
- Final root count: 5,120 tests passed.
