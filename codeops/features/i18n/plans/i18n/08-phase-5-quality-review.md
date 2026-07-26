# Phase 5 quality review

> **Scope**: Phase 5 documentation, plugin, review-evidence, and performance diff from baseline
> tree `93861d173212caaee94cf80e5d5a02d797c58bf2`
>
> **Profile**: Strict correctness review plus performance audit
>
> **Status**: PASS — all findings corrected and the one-time re-review completed; external
> translation approvals remain the release blocker

## Findings and rulings

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-5-001 | Major | Accepted by auto-design | Gate the `lockstep:version` command used first by `release:prepare`, before any version mutation |
| RV-5-002 | Major | Accepted by auto-design | Replace the label-only example with a localized interactive Theme Designer supporting selection, live preview, apply, and cancel rollback |
| RV-5-003 | Major | Accepted by auto-design | Generate TypeDoc for the Node and four locale surfaces plus a 42-link entry-point index |
| PE-5-001 | Major | Accepted by auto-design | Enforce the built-artifact benchmark in the serial gate even in CI |
| PE-5-002 | Major | Accepted by auto-design | Make the standalone `dist` benchmark authoritative instead of the duplicated source timing oracle |
| RV-5-004 | Minor | Corrected | Generate package-specific import guidance for every dedicated plugin API category |
| RV-5-005 | Minor | Corrected | Add a caller-owned abort/timeout custom-source example to the canonical skill |
| RV-5-006 | Minor | Corrected | Validate real Gregorian review dates and add an impossible-date regression |

No finding was waived or dismissed.

## Auto-design correction

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: These changes harden already-approved release gating, documentation completeness,
  plugin guidance, review evidence, and benchmark execution. They do not approve translations,
  change supported locales, or alter public product behavior.
- **Objective**: Ensure release remains impossible without human evidence, every advertised entry
  point is generated and linked, the runnable recipe demonstrates its named workflow, and the
  performance gate measures shipped code in CI.
- **Decision**: Put the existing review verifier first in the `lockstep:version` command invoked by
  `release:prepare`, while retaining `yarn verify` as the implementation gate defined by the execution plan. Generate TypeDoc for the
  Node loader and each package's official locale exports, with a deterministic index over the main,
  Node, and 40 locale subpaths. Run the published `dist` benchmark directly from `perf:check`; keep
  the immutable Vitest file as a specification oracle rather than the authoritative wall-clock
  runner. Implement the Theme Designer with localized framework controls, source-color selection,
  live preview, OK commit, and Cancel rollback.
- **Evidence**: Direct review verification reports 36 missing approvals; the prior release script
  mutated versions without checking them. The docs generator covered only the main barrel. The
  prior recipe constructed only static text. The serial test skipped ceilings under `CI` and
  measured source while a separate `dist` benchmark existed.
- **Rejected alternatives**: Adding human review to the normal implementation gate would
  contradict the accepted separate external task and make all development CI permanently red;
  hand-written locale links could drift; keeping both timing loops authoritative would preserve
  divergent workloads; accepting a label-only example would misrepresent the recipe.
- **Strongest counterargument**: Five extra TypeDoc runs increase docs generation time. They make
  the Node and locale surfaces verifiable and linked, which outweighs the bounded build cost.
- **Confidence**: High — every correction has a focused executable or structural regression and
  preserves the accepted public API.
- **Hardening**: Independent correctness and performance reviewers identified complementary
  release and measurement gaps; all Major findings received concrete corrections.
- **Policy version**: 1.
- **Root invocation ID**: `i18n-20260725-01`.
- **Reopen triggers**: Locale entry points become generated from a different manifest, release
  orchestration changes, review evidence moves to a signed service, or the repository adopts one
  shared benchmark harness that specification tests may import.

## Correction evidence

- `release:prepare` invokes the review-gated `lockstep:version` command before any other mutation;
  the current empty manifest intentionally reports 36 missing approvals.
- The Theme Designer now derives semantic themes from six source colors, previews on focused
  selection, commits on OK, and restores the committed theme on Cancel.
- Docs generation emits the main i18n API, Node API, four package-locale API trees, and a generated
  entry-point index with 42 links.
- The plugin API page names `@jsvision/i18n`, and its canonical guide includes a custom remote
  source with caller-owned abort and timeout.
- Review dates round-trip through UTC calendar components, rejecting impossible values.
- The serial performance command executes the built package benchmark, whose CLI enforces the
  published warm median and p95 ceilings regardless of CI.

## One-time fix re-review

The reviewer confirmed all eight accepted findings resolved and found no new Critical or Major
issue. It verified the review-before-version invariant, interactive Theme Designer behavior, 42
generated entry-point targets, built-artifact performance enforcement in CI, package-correct plugin
guidance, custom source example, and calendar-date rejection. A subsequent compatibility correction
moved the review command into the first `lockstep:version` step while preserving the same
review-before-mutation invariant; the existing release-preflight and new review-gate regressions
both pass. Per policy, no third review was dispatched.

## Final verification evidence

- Focused documentation passed 96 tests; review verification passed 7 tests.
- Plugin parity and the serial built-artifact performance gate passed.
- Generated docs include the main i18n, Node, and four locale API trees plus the deterministic
  42-link entry-point index.
- Root `yarn verify` passed all 34 Turbo tasks after the review corrections.
- The standalone translation-review verifier intentionally remains red with 36 `MISSING_REVIEW`
  issues until proficient reviewers approve the checked catalog digests.
