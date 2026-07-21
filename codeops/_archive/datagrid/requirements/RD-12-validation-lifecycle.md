# RD-12: Validation & Lifecycle

> **Document**: RD-12-validation-lifecycle.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-02, RD-03
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

The commit-safety layer: per-cell validation, a per-row cross-field gate, the BeforeSave veto, error
surfacing (cell markers + a message area), and the grid's loading / empty / error states. This is
where "per-cell immediate write-through" is made safe — the in-memory value updates instantly, but a
value only *persists* after passing this pipeline (resolving the AR-02 timing nuance). Client-side
validation here is UX; server-side validation remains the authoritative security boundary.

---

## Functional Requirements

### Must Have

- [ ] **Per-cell validation** — the column's validator (RD-03) runs live (keystroke filter) and on
      commit (`valid()`); an invalid value blocks the commit, keeps the editor open, and marks the
      cell in the error role.
- [ ] **Per-row cross-field gate** — an optional `validateRow(row): { ok: boolean; message?: string;
      field?: columnId }` run on row-leave / before persistence; a failing row cannot be committed and
      the cursor refocuses the first invalid field (the dialog `valid()`-gate pattern).
- [ ] **BeforeSave veto** — an optional `beforeSave(change | row): boolean | Promise<boolean>` (trusted
      caller TS); a veto reverts the value and surfaces the reason. This layers above `onCommit`
      (RD-01) — `beforeSave` decides *whether* to persist; `onCommit` *performs* persistence.
- [ ] **Error surfacing** — invalid cells paint an error marker; a message area (a footer widget by
      default, RD-09) shows the active validation/veto message; clearing the error clears the marker.
- [ ] **Loading / empty / error states** — the grid shows a `Spinner` while a source range/initial load
      is pending, a caller-configurable **empty state** when the (filtered) row count is 0, and an
      **error state** when a source load/commit fails (with a retry affordance).

### Should Have

- [ ] **Optimistic concurrency / conflict detection** — detect a stale write (the row's source version
      changed since load) and surface a conflict instead of silently overwriting. *Phase B.*
- [ ] **Pending / "saving…" row state** — a row with an in-flight async `onCommit` shows a pending
      indicator. *Phase B.*
- [ ] **Commit error recovery / retry** — a failed `onCommit` marks the cell/row and offers retry.
      *Phase B.*

### Won't Have (Out of Scope)

- Undo/redo of committed edits — deferred (AR #30).
- Server-side validation implementation — the host/source owns it; the grid surfaces its result.

---

## Technical Requirements

### Validation pipeline (per-cell commit)

```
edit → live filter (reject disallowed keystrokes)
Enter/Tab → value = parse(field)
          → column.validator.isValid(value)?        no → mark error, keep editor open
          → applyToRecord (in-memory, immediate)
          → validateRow(row)? (on row-leave)        no → block, refocus first invalid
          → beforeSave(change|row)?                  veto → revert, surface reason
          → onCommit(change)                         false/reject → revert, keep editor open
          → clear dirty/error
```

- The four gates are independent and composable; each may be sync or async. A gate that rejects reverts
  the in-memory record to `previous` and surfaces its message. While an async gate is in flight for a
  cell, that cell is locked against re-entry and overlapping commits for it are serialized (RD-02); the
  cell shows the pending/dirty marker until the pipeline resolves.

### State model

- `state: 'loading' | 'ready' | 'empty' | 'error'` reactive; the render switches the body for
  loading/empty/error; `ready` shows the grid. Errors carry a message + a `retry()` action.

---

## Integration Points

- Sits on the RD-02 commit seam and the RD-01 `onCommit`; consumes RD-03 validators; surfaces messages
  in the RD-09 footer; empty/loading/error coordinate with RD-11's windowed loading.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Immediate vs validated | validate-before-apply / apply-then-gate | Apply in-memory, gate persistence | Resolves per-cell-immediate nuance | AR #2 |
| Row gate | none / cross-field gate | Cross-field gate + refocus | Enterprise data integrity | AR #16 |
| Veto | none / BeforeSave | BeforeSave (trusted TS) | Spike-proven hook | AR #25 |
| Concurrency/pending/retry | v1 / P2 | P2 | Core validation first | AR #10 |

---

## Security Considerations

- **Data sensitivity**: validation reads caller values; messages may echo input — sanitized before
  render.
- **Input validation**: this RD IS the client-side input-validation layer (filter + validator + row
  gate). **It is UX, not the security boundary** — per the project's security standards, server-side
  validation in the caller's `onCommit`/source is authoritative; the grid never treats client
  validation as sufficient for persistence safety (documented prominently).
- **Injection risks**: validation/veto messages and echoed input pass `sanitize` (RD-04) before
  render; a malicious value cannot inject control bytes via an error message.
- **Authorization**: `beforeSave`/`onCommit` are the caller's trusted enforcement points; the grid
  offers the seam, the caller enforces permission.
- **Encryption / rate limiting / infrastructure**: N/A (in-process).

---

## Acceptance Criteria

1. [ ] Committing a value that fails the column validator blocks the commit, keeps the editor open, and
       marks the cell in the error role; correcting the value clears the marker and allows commit.
2. [ ] A row failing `validateRow` cannot leave/commit; the cursor refocuses the reported invalid field
       and the message area shows the row message.
3. [ ] `beforeSave` returning `false` (or rejecting) reverts the value to `previous` and surfaces the
       reason; `onCommit` is not called when `beforeSave` vetoes.
4. [ ] Ordering is enforced: live filter → validator → in-memory apply → row gate → beforeSave →
       onCommit; a rejection at any gate reverts to `previous`.
5. [ ] The grid shows a `Spinner` while an initial/window load is pending, the configured empty state
       when the filtered count is 0, and an error state with a working `retry()` when a load fails.
6. [ ] A validation message echoing input containing a control byte renders sanitized.
7. [ ] A `datagrid` kitchen-sink story demonstrates a rejected edit (validator) + a row-gate veto and
       passes the smoke test.
8. [ ] Security verified: client validation is documented as UX-only with server-side authoritative;
       messages/echoed input are sanitized; no persistence bypasses `onCommit`.
