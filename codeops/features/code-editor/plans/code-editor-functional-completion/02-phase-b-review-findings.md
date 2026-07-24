# Phase B quality review findings

> **Reviewed**: 2026-07-25
> **Scope**: T-04.7 through T-04.12
> **Authority**: AI — delegated by `--auto-design`

The correctness, security, and performance reviewers independently examined the Phase B diff.
Every Critical or Major finding is accepted for correction; no risk finding is waived or
dismissed.

| Finding | Severity | Decision | Resolution |
|---|---|---|---|
| RV-B-001 / PE-B-003 | Major | Accept | Order trigger requests after document-change enqueueing, using an explicit synchronous-enqueue session guarantee only where the transport provides one. |
| RV-B-002 | Major | Accept | Close provider completion after ordinary typing so stale visible candidates cannot be accepted. |
| RV-B-003 / SA-B-002 | Major | Accept | Invalidate every revision-bound assistance surface and navigation origin after an accepted mutation. |
| RV-B-004 | Major | Accept | Follow and reveal snippet placeholder selection changes immediately. |
| RV-B-005 | Major | Accept | Normalize singleton definition responses and make local navigation unfold and reveal its target. |
| RV-B-006 | Major | Accept | Keep contextual formatting inert when a non-empty selection lacks range-formatting capability. |
| RV-B-007 / SA-B-001 | Major | Accept | Settle stale pre-issue operations immediately and reject every callback whose operation is no longer live. |
| RV-B-008 | Major | Accept | Add canonical editor commands and keyboard bindings for explicit hover and document symbols. |
| RV-B-009 | Major | Accept | Preserve fold and diagnostic non-color indicators in separate existing gutter cells. |
| RV-B-010 | Major | Accept | Extract Phase B assistance, request-lifecycle, and key-routing responsibilities into focused modules. |
| PE-B-001 | Major | Accept | Avoid duplicate presentation refresh and validated-state deep copying on ordinary caret and popup navigation. |
| PE-B-002 | Major | Accept | Replace the per-row linear diagnostic gutter scan with a sorted-range lookup. |
| PE-B-004 | Major | Accept | Enforce response-wide completion edit and replacement-character budgets before retention. |
| PE-B-005 | Major | Accept | Release subscriptions and connecting gates before best-effort asynchronous `didClose`. |
| SA-B-003 | Minor | Accept | Reject control-bearing URIs and sanitize navigation display labels independently from authorized raw targets. |

Corrections require focused regressions for asynchronous notification ordering, late
cancelled/timed-out responses, edit-between-result-and-action cases, off-screen snippets,
singleton navigation, formatting capability loss, user-operable hover/symbol commands,
fold-plus-diagnostic gutters, aggregate completion floods, and hanging close transports. One
scoped re-review will assess the accepted Major fixes.

## Re-review closure

The permitted scoped re-review confirmed that every accepted Major was resolved except the
structural portion of RV-B-010: keyboard routing and editing algorithms still remained embedded in
the editor facade. The parent executor completed that correction after the re-review by extracting
those responsibilities into `ui/editing-actions.ts`; `ui/code-editor.ts` is now below the
project's 700-line ceiling. Per the review cap, this final correction is closed by focused tests,
static checks, and the authoritative repository verification rather than a second re-review.
