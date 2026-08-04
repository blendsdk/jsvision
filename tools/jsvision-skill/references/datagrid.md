# Enterprise grids with `@jsvision/datagrid`

Use UI `DataGrid` for read-oriented tables. Use `EditableDataGrid` for typed columns, editing, validation, selection, sorting, filtering, frozen areas, virtualization, personalization, export, or master-detail.

1. Define stable row types and keys.
2. Build columns with `column`; choose width, alignment, format, parse, editing, and validation.
3. Adapt data with `fromRows`, `fromReactiveRows`, or a windowed source.
4. Wrap the grid with loading/error/empty state.
5. Wire controlled selection, sorting, filtering, commit, validation, and atomic row recovery where persistence requires it.
6. Persist personalization only with schema versioning.

Consult [the generated Data Grid API](api/datagrid.md) for exact signatures. Distinguish parse,
validation, persistence, and row-recovery failures. Preserve edits on failed commits. Bound
dirty/error registries. Suppress stale window requests. Avoid per-cell effects and unstable
row/column objects.

## Recover a row after commit-then-trap validation

`validateRow` evaluates a row only after at least one cell commit is accepted and navigation tries
to leave that row. When it rejects the leave, the grid keeps focus in that row and retains the
earliest pre-session value for every changed column. This is a bounded trapped-row session, not a
general undo stack.

Escape ownership is deliberate:

- An open cell editor consumes Escape to cancel only its current uncommitted text.
- The focused grid body consumes Escape only after the edited row has trapped.
- A valid, untouched, or already released row lets Escape fall through normally.
- A pending row revert consumes every competing grid-owned edit, navigation, selection, filter,
  value-help, focus-transfer, and row-mutation action until settlement.

If accepted cell commits reach host persistence through `beforeSave` or `onCommit`, provide one
atomic `onRevertRow` callback. It receives the original row after all retained baselines are applied
and a frozen changed-cell list in first-commit order. Each cell uses commit-aligned vocabulary:
`value` is the restored baseline and `previous` is the committed value immediately before the
attempt. Return `false`, throw, or reject to compensate to those committed values. The trap remains
available for retry only while the same row and session remain live and compensation completes;
stale settlement compensates its captured row but cannot reattach retry state.

Without `onRevertRow`, the grid may restore locally only when neither per-cell persistence/policy
hook is configured. Otherwise it reports that row changes cannot be reverted and keeps the session
trapped, preventing silent divergence from the source. A successful revert keeps focus on the
restored row; the next navigation may leave normally.

Keep row keys and row object identity stable during a session. Sorting, filtering, or republishing
the same key-and-object collection may preserve it. Removal, replacement, key reuse, or disposal
invalidates UI/session ownership, and late asynchronous settlement cannot attach to a replacement
row. Never echo callback exceptions or row values in status text; package-owned localized feedback
is the safe diagnostic boundary.

Test window boundaries, invalidation, selection persistence, frozen regions, empty results, partial
failures, navigation, row-revert accept/veto/retry, narrow widths, and unsaved edits. Do not rely on
color alone for focus, selection, dirty, pending, or invalid states.
