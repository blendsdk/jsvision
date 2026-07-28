# Phase 4 quality review

> **Scope**: Phase 4 consumer-package and official-locale diff from baseline tree
> `b2a753c0d4a154e0cc6684d902d1b00f0d2ebd8c`
>
> **Profile**: Strict correctness review plus public API/package-surface audit
>
> **Status**: PASS — all Major findings were corrected and the one-time re-review completed

## Findings and rulings

| Finding | Severity | Ruling | Resolution |
|---|---|---|---|
| RV-4-001 | Major | Accepted by auto-design | Complete the 14 missing Datagrid translations in each of `pt-PT`, `pl`, `ro`, and `sv`, and enforce explicit non-English override coverage |
| RV-4-002 / PA-4-002 | Major | Accepted by auto-design | Route every manifest-listed Forms, Files, and Datagrid label through a package-local required/optional accelerator validator and add malformed-override regressions |
| RV-4-003 | Major | Accepted by auto-design | Size the ChDir action column from translated button display widths and cover all ten locales |
| RV-4-004 | Major | Accepted by auto-design | Replace localized month `.length` geometry with terminal display-cell measurement and add wide/combining coverage |
| PA-4-001 | Major | Accepted by auto-design | Deep-freeze the public UI accelerator manifest and all nested arrays/scopes |
| RV-4-005 | Major | Accepted by auto-design | Expand editor accelerator scopes to the complete co-visible dialog controls and correct official marker collisions |
| RR-4-001 | Major | Accepted by auto-design | Preserve canonical Cancel on `C`, move canonical editor Case-sensitive to `S`, and validate the no-service English catalog against the complete public scopes |

No reviewer reported a critical or minor finding. No Major finding was waived or dismissed.

## Auto-design correction

- **Authority**: AI — delegated by `--auto-design`.
- **Eligibility**: The corrections implement already-approved translation completeness,
  accelerator recovery, display-cell geometry, and readonly public metadata. They neither change
  product scope nor reserve user authority.
- **Objective**: Make every advertised official catalog complete, keep malformed application
  labels keyboard-safe per key, prevent localized clipping, and keep public validation metadata
  immutable.
- **Decision**: Apply all six corrections and add focused regressions before the full repository
  gate. Package-local label helpers preserve package boundaries and the accepted internal-helper
  design. Datagrid keeps accelerator markers optional but rejects malformed markup.
- **Evidence**: The phase diff showed English-filled Datagrid omissions, direct `i18n.t()` calls at
  manifest-listed controls, fixed ten-cell ChDir actions, `.length` month positioning, and one
  mutable public manifest. Runtime layout output also reported duplicate editor accelerators,
  which is included in the correction audit of scope topology.
- **Rejected alternatives**: Waiving partial translations contradicts the release contract;
  sanitizing whole catalogs discards valid application overrides; JavaScript-length layout remains
  wrong for wide/combining glyphs; documenting manifest immutability without freezing does not
  enforce it.
- **Strongest counterargument**: Package-local accelerator parsers repeat a small rule. A new shared
  public engine helper would enlarge the frozen API solely for internal rendering, so isolated
  helpers are the lower-risk correction.
- **Confidence**: High — each fix follows an existing accepted contract and has a direct regression
  seam.
- **Hardening**: Independent correctness and API audits converged on the accelerator defect; all
  Major findings are fixed rather than waived.
- **Policy version**: 1.
- **Root invocation ID**: `i18n-20260725-01`.
- **Reopen triggers**: Accelerator parsing becomes a first-class public engine API, layout adopts a
  capability-selected width mode, or official locale coverage policy changes.

## Correction evidence

- The Datagrid locale builder now requires a complete typed message map, and `pt-PT`, `pl`, `ro`,
  and `sv` provide the previously missing operator, status, and automatic-width translations.
- Forms, Files, Datagrid, and UI editor controls recover malformed application accelerator labels
  per key; explicit caller labels remain authoritative.
- FileDialog and ChDirDialog size action columns from translated button measurements. Ten-locale
  ChDir regressions and the existing ten-locale composed-dialog suite pass.
- File metadata positions translated months with `stringWidth`; a wide-glyph month remains intact
  before the day/year fields.
- The public UI accelerator topology is deeply frozen and includes complete find/replace dialog
  scopes. Official catalogs validate cleanly and the composed layout log has no duplicate shortcut
  warning.
- The four-package literal inventory recognizes translation-helper defaults and classifies all 32
  current candidates.

## One-time fix re-review

The reviewer confirmed RV-4-001 through RV-4-004 and PA-4-001/PA-4-002 resolved. It found one
remaining Major edge: canonical no-service English still paired Case-sensitive and Cancel on `C`.
The correction preserved the universal Cancel shortcut and moved only canonical Case-sensitive to
`S`, leaving rendered English text unchanged. A canonical-catalog scope regression, focused layout
tests, and the full repository gate pass. Per policy, no third review was dispatched.

## Final verification evidence

- Focused Forms, Files, Datagrid, UI, locale, literal, and display-cell correction suites passed.
- All four affected package builds/typechecks and all 40 locale export/parity contracts passed.
- `yarn plugin:update` regenerated every impacted canonical/distributed reference.
- Root `yarn verify` passed all 34 Turbo tasks plus lint, locale/literal drift, documentation, and
  plugin-integrity gates.
