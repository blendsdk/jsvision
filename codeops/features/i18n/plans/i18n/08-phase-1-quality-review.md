# Phase 1 quality review

> **Scope**: Phase 1 browser-safe engine diff from baseline tree
> `540e03aa0d50b6c851f69946ec748214bbac85c3`
>
> **Profile**: Strict defaults — independent correctness, security, and performance review
>
> **Status**: PASS — all accepted major findings corrected and the full repository gate passed

## Findings and rulings

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-001 | Major | Accepted by auto-design | Strictly copy and validate every validation option and nested manifest; malformed CI policy is blocking |
| RV-002 / SA-002 / SA-004 | Major | Accepted by auto-design | Centralize trap-safe object/array inspection; recover from inaccessible params and translate configuration failures |
| RV-003 | Major | Accepted by auto-design | Add scope `requiredKeys`, defaulting to all `keys`, so optional unaccelerated labels retain collision topology |
| RV-004 | Major | Accepted by auto-design | Correct README accelerator syntax to `~X~` and literal `~~` |
| SA-001 | Major | Accepted by auto-design | Move service/cache state to ECMAScript private fields and publish runtime-readonly Map facades |
| SA-003 | Major | Accepted by auto-design | Bound cases, case names, and aggregate catalog message bytes |
| PE-001 / RV-006 | Major | Accepted by auto-design | Add observable trusted `Intl` construction and internal compilation counting; regression-test the warm path |
| PE-002 | Major | Accepted by auto-design | Resolve plural categories once per catalog validation |
| RV-005 | Minor | Fixed opportunistically | Replace ambient `localeCompare` issue sorting with deterministic lexical comparison |
| PE-003 | Minor | Fixed opportunistically | Resolve plural rules lazily and avoid freezing a transient selected-case object |
| PE-004 | Minor | Fixed opportunistically | Reuse default formatter identities for empty options and reduce cache-key temporaries |

No reviewer reported a critical finding. Major findings were not waived or dismissed.

## One-time fix re-review

The required re-review confirmed that PE-001–PE-004, RV-001, RV-003–RV-006, and SA-001–SA-004
were resolved. It rejected RV-002's initial closeout and identified four additional major findings
plus one minor hardening opportunity:

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-002 | Major | Reopened and fixed | Handle revoked proxies at translation options, formatter options, and `mergeCatalogs` with typed errors |
| RV-R001 | Major | Accepted by auto-design | Apply the shared 512-scalar and safe-text policy to every nested validation-policy message key |
| SA-R002 | Major | Accepted by auto-design | Bound aggregate structured cases and case-name bytes across a catalog |
| SA-R003 | Major | Accepted by auto-design | Observe trusted `Intl` allocation through internal counters without invoking ambient replacements |
| PE-R001 | Major | Accepted by auto-design | Persist the aggregate-message limit state and stop encoding or compiling later messages |
| SA-R001 | Minor | Fixed opportunistically | Freeze service instances after private state initialization |

The corrective pass added regression coverage for every item above. In accordance with the quality
policy, no third review was dispatched after the one-time fix re-review; the focused and root
verification gates provide the final closeout evidence.

## Auto-design decisions

The review exposed two technical details inside already-approved security and accelerator behavior:

- Structured messages accept at most 256 cases, catalogs accept at most 16,384 structured cases,
  select case names accept at most 512 Unicode scalar values and 4 MiB in aggregate, and aggregate
  in-memory catalog message text is capped at 16 MiB. This preserves substantial headroom above the
  2 MiB file-source limit while preventing per-string limits from multiplying without bound.
- `AcceleratorScope.keys` retains every co-visible label. Optional `requiredKeys` defaults to all
  keys and may name the subset that must carry `~X~`, allowing a natural unaccelerated translation
  without losing collision topology.

Both decisions were delegated by `--auto-design`, independently challenged by the phase reviewers,
and remain reopenable if real catalogs approach the bounds or accelerator topology becomes generated.

## Verification evidence

- Review regression tests were observed red: 14 failed, 2 passed.
- Focused corrected suite: 61/61 tests passed.
- Package final suite: 159/159 tests passed across 11 files.
- Package typecheck, JSDoc, and dependency checks passed.
- Root `yarn verify` passed: lint/formatting, 34/34 Turbo tasks, and Codex plugin integrity.
- The required one-time correctness, security, and performance fix re-review completed.
