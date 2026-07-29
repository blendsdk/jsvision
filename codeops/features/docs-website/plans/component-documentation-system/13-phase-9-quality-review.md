# Phase 9 Quality Review

## Review context

- Baseline tree: `1ab0abe500117be6b8300acddbd6f56a21bf1a02`
- Reviewer: independent `preflight_fit` agent
- Commit mode: `--auto-commit`
- Design mode: `--auto-design`
- Pre-review verification: `yarn verify` passed in 141.42 seconds
- Security/performance audit: covered by the focused export-injection, bounded-window, full-array
  guard, and authoritative performance/plugin gates

## Pass 1 findings and rulings

| ID | Severity | Finding | Auto-design ruling |
| --- | --- | --- | --- |
| RV-901 | Major | The 24 behavior contracts were shape-checked but never executed, and action/probe expectations had drifted from the labs. | Accepted: add a target-owned lab controller, rebuild per case, dispatch every bounded action, assert every typed probe, dispose after every case, and run template1 evidence for all 24 labs. |
| RV-902 | Major | Several flagship objectives were status-only or absent, including typed/null cells, editor kinds, async commit, detail, partial aggregates, and personalization. | Accepted: add real typed percentage/null columns, date/lookup/custom rating editors, async commit behavior, complete/partial source state, a mounted detail projection, corrected variant capture, and the real `personalizeGrid` flow. |
| RV-903 | Major | Several teaching snippets used invented or outdated public API shapes. | Accepted: rewrite every cited snippet around current public barrels, `source`, `selectionMode`, the real `GridDataSource` seam, `GridFooter`, `createMemoryVariantStore`, application-owned theming, and complete column fields. |
| RV-904 | Major | Export fixtures used a literal backslash-n and exposed only two of four promised formats. | Accepted: add actual newline, CRLF, tab, quote, comma, markup, and all four spreadsheet formula prefixes; expose CSV/TSV/HTML/JSON actions and assert their real serializers. |
| RV-905 | Major | Common instructions and many objectives clipped, while not every example ran the template evidence collector. | Accepted: shorten every objective and the common instruction to the 70-cell content width, reserve two status rows, sanitize control characters in the visible grid, and collect template1 evidence for all examples. |
| RV-906 | Minor | One large switch centralized unrelated scenario behavior. | Accepted in part: move typed input/probe behavior into a dedicated scenario controller and retain the shared shell/layout builder; further splitting is unnecessary while the focused modules remain below the project file-size ceiling. |

Ruling provenance: delegated by `--auto-design`; every correction is bounded to the Data Grid hub,
its docs-local fixtures, its live examples, and its specification/implementation evidence. No
finding was waived or dismissed.

## Re-review

The single permitted independent re-review closed RV-901, RV-904, and RV-905. It reported two
residual Major findings and one residual Minor:

| ID | Re-review result | Final correction or disposition |
| --- | --- | --- |
| RV-901 | Closed | All independently rebuilt cases execute their complete action sequences against mounted examples. |
| RV-902 | Major residual | Corrected: editing, custom-editor, asynchronous commit, validation, and personalization inputs now reach the real grid or modal. Probes read public grid state, source rows, async callback status, and modal outcomes instead of simulating those behaviors. |
| RV-903 | Major residual | Corrected: the remaining low-level constructor snippets now use complete `EditableDataGrid` configurations. A semantic TypeScript compilation test guards both copyable focused-usage snippets against the real public declarations. |
| RV-904 | Closed | Real hostile values and all four export paths remain executable. |
| RV-905 | Closed | All 24 examples retain complete template1 geometry and bounded text. |
| RV-906 | Minor residual | Report-only: the shared 24-scenario lab builder remains 800 lines. The scenario controller is separate, but a future fixture-only refactor should split action construction by concern. This does not affect runtime behavior or the public documentation surface. |

No third review was dispatched because the quality profile permits one re-review. The accepted
Major corrections are covered by the final focused and authoritative verification below.

## Verification evidence

- Corrected focused typecheck passed.
- Corrected Data Grid topology, executable objective, snippet compilation, trust, lifecycle, scale,
  and export suites: 100/100 passed.
- Complete docs-site unit suite: 629/629 passed.
- Post-review authoritative verification: `yarn verify` passed in 143.39 seconds, including lint,
  formatting, i18n checks, all package typechecks/builds/docs checks/tests, performance gates, and
  plugin integrity.
