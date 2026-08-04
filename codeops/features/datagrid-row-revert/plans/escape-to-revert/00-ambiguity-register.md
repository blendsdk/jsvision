## Ambiguity Register: Data Grid Escape-to-Revert

> **Status**: ✅ GATE PASSED — all 14 items resolved
> **Last Updated**: 2026-08-04 01:41

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Feature gaps | Is this a repair to commit-then-trap, general undo, or a new row-recovery capability? | Preserve commit-then-trap and add recovery / change row validation / build general undo | Preserve commit-then-trap and add the scoped recovery capability described in GitHub issue #100. | ✅ Resolved |
| 2 | Scope ambiguities | Should the work use a lightweight maintenance task, reopen the archived Data Grid feature, or receive a standalone feature plan? | Maintenance mini-plan / unarchive Data Grid / standalone `datagrid-row-revert` feature | Create the full standalone feature `datagrid-row-revert` with the plan `escape-to-revert`; keep the archived Data Grid feature unchanged. | ✅ Resolved |
| 3 | Behavioral gaps | When does body-level Escape become eligible, and when does eligibility end? | Any touched row / only after a failed leave / general history after leaving | Escape becomes eligible only after the current session fails `validateRow`; it remains eligible through corrections until a successful leave, and that leave permanently discards the session. | ✅ Resolved |
| 4 | Behavioral gaps | What wins when Escape is pressed with a cell editor open, and should a row revert move focus? | Editor cancel then row revert / editor cancel only / row revert first; move or stay | The first Escape cancels only the open editor. A later body Escape reverts the trapped session and keeps the cursor on the restored row without moving it. | ✅ Resolved |
| 5 | Technical unknowns | How does rollback participate in application persistence without partial multi-cell writes? | Explicit row transaction callback / replay per-cell callbacks / local-only restore | Add an explicit atomic `onRevertRow` callback. Reject per-cell replay and local-only rollback when persistence or policy callbacks are configured. | ✅ Resolved |
| 6 | Data & state | What baseline is retained, and can arbitrary row records be cloned? | Whole-row clone / all columns at first touch / earliest value per successfully committed column | Journal only successfully committed editable columns and retain each column's earliest pre-session value; never clone generic row records. | ✅ Resolved |
| 7 | Data & state | How are sessions identified and prevented from attaching to a replacement row? | Display index / row key only / row key plus original object identity | Key sessions by stable row key and retain original row identity. Invalidate on observable removal, object replacement, key reuse, or disposal. Republishing a collection with the same key+object identities preserves the session because the current source API exposes no distinct reset event. | ✅ Resolved |
| 8 | Integration points | What happens for an in-memory grid or a grid with persistence/policy callbacks but no rollback callback? | Always local / require callback for every grid / local only without `beforeSave` or `onCommit` | Invoke `onRevertRow` whenever supplied. Without it, a grid with neither `beforeSave` nor `onCommit` may revert internally; otherwise Escape keeps the trap/session and reports that revert is unavailable. | ✅ Resolved |
| 9 | Integration points | How should reactive sources and master-detail links observe the rollback? | Replace row objects / mutate through recorded column setters / special source API | Restore through the committed columns' existing typed setters, publish one coherent grid version update where practical, and keep stable write-through row references so reactive and master-detail consumers see the same row state. | ✅ Resolved |
| 10 | Edge cases | What happens during asynchronous rollback and on callback rejection, throw, or re-entry? | Acceptance-first / optimistic with compensation / unguarded | Apply optimistically through the setters, show pending state, and block grid edits/navigation/deletion/focus transfer and duplicate rollback. False/throw/reject compensates to the pre-revert committed values and retains a retryable trapped session. | ✅ Resolved |
| 11 | Security & compliance | May rollback diagnostics expose row data, callback errors, or unsafe terminal text? | Raw diagnostics / bounded package-owned messages | The callback receives only the required row reference and immutable changed-cell descriptors; no row values or host errors are logged, and all displayed text remains sanitized at the draw boundary. | ✅ Resolved |
| 12 | Non-functional gaps | What resource and compatibility boundaries apply? | Unbounded history / active-session journal; breaking keymap / additive action | Retain only active sessions and changed columns, clean them deterministically, add a remappable `revertRow` action with default plain Escape, preserve editor precedence, and keep existing behavior unchanged for untouched/read-only/empty grids. | ✅ Resolved |
| 13 | UX & presentation | What exact package-owned messages and composition rule ship? | Concatenate an English hint / localized full template plus state messages / separate multi-row band | Use localized keys with exact English text: trapped template ``${message} · Esc reverts row changes``; pending `Reverting row…`; failure `Could not revert row changes`; unavailable `Row changes cannot be reverted`. The trapped template owns locale ordering and the caller message remains a parameter. | ✅ Resolved |
| 14 | Naming & terminology | What exact exported callback types and payload fields ship? | `RowRevertChange` with `current`/`baseline` / `RowRevert` with commit-aligned `value`/`previous` / source-level rollback API | Export `RowRevertCell`, `RowRevert<T>`, and `OnRevertRow<T>`. `RowRevert` contains `rowKey`, the already-restored `row`, and a frozen `cells` list; each cell contains `columnId`, `value` (restored baseline), and `previous` (committed value before revert), matching `CellCommit` timing and vocabulary. | ✅ Resolved |

### Resolution Notes

**AR-1 through AR-12:** The user confirmed the grounded recommendations, scope, feature name, and verification set presented after the issue and source analysis on 2026-08-03.

**AR-3:** "Corrected then Escape" applies only to a session that has already trapped and has not completed a successful leave. A correction committed with Enter may immediately pass the leave gate and discard the session; a correction committed while remaining within the row does not.

**AR-5:** The explicit row callback is the only surviving persistence design because replaying multiple `onCommit` calls can partially persist before a later cell fails.

**AR-7:** Sorting, column hiding, and collection republication preserve a session while the same key
and row object remain present. Observable disappearance, object replacement, key reuse, or disposal
invalidates UI/session ownership. A pending transaction still owns settlement of its captured
original row: a veto compensates that row, while stale guards prohibit replacement-row or disposed
UI writes. A live stale attempt may idempotently detach only its own dirty/pending presentation and
reconcile a newly discovered replacement or still-visible compensated original. Application code
retains the existing commit contract obligation not to concurrently mutate the same changed fields
while a trusted commit/revert callback is pending.

**AR-10:** Optimistic rollback follows the existing `commitCell` timing. Editable column setters
must be synchronous, deterministic, and non-throwing for the documented atomicity guarantee.
Rollback catches a violated setter precondition, best-effort restores the already-applied prefix in
reverse order, ends pending state, invalidates the untrustworthy session, and never invokes
`onRevertRow` after a failed optimistic apply. Callback failure is isolated as a veto rather than
exposed to the event loop.

**AR-11:** This in-process SDK feature introduces no authentication, network, database, rate-limiting, encryption, or secret-management surface. Its applicable security boundary is safe callback isolation, bounded state, and terminal-output sanitization.

**AR-13:** User confirmed the exact localized strings and parameterized trapped-message composition on 2026-08-03.

**AR-14:** User confirmed the exact public type names and commit-aligned payload vocabulary on 2026-08-03.
