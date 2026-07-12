# RD-02: Editing Engine & Commit Model

> **Document**: RD-02-editing-engine.md
> **Status**: Draft
> **Created**: 2026-07-12
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-01
> **CodeOps Skills Version**: 3.4.1

---

## Feature Overview

The interactive heart of the grid: the `EditableDataGrid<T>` component, its two-axis cell cursor
(row + column), the in-cell editor-overlay lifecycle, per-cell immediate write-through commit, dirty
tracking, and the keyboard flow (begin-edit, commit, cancel, auto-advance). It reuses the exposed
`GridRows` engine (RD-01) as an additive subclass — the proven spike result that a column cursor does
not fight the engine's row-focus model — and consumes the `GridColumn`, `GridDataSource`, `rowKey`,
`OnCommit`, and overlay-helper contracts from RD-01. Typed editors themselves are RD-03; the
validation gate is RD-12.

---

## Functional Requirements

### Must Have

- [ ] **`EditableDataGrid<T>`** — a `Group` composing the exposed `GridHeader` + an editable body +
      optional footer band (RD-09), sized via the width-matched band layout the read-only `DataGrid`
      uses; free `layout` for absolute placement. The body is **one or more** `EditableGridRows`
      panels — a single panel when nothing is frozen, or the left/center/right split when RD-07's
      freeze is active — all bound to the container's shared cursor/selection/scroll signals. The
      container (not the row-renderer) owns that shared state, so the panel model is a **foundational**
      decision made here, not a later retrofit in RD-07.
- [ ] **Cell cursor** — an `EditableGridRows<T>` subclass of `GridRows` whose cursor state
      (`focusedCol`, the row `focused`, the vertical-scroll offset, and selection) is **owned by the
      `EditableDataGrid` container and injected as shared signals** into each panel — so the frozen
      left/center/right panels (RD-07) share one cursor by construction. This is grounded in the engine
      already sharing `focused`/`selected` via `GridRowsConfig`; `focusedCol` is the additional shared
      signal the container owns. The focused *cell* is overpainted so the cell (not just the row) is
      visible.
- [ ] **Cursor navigation** — `↑`/`↓` move the row (inherited), `←`/`→` move the column, `Tab`/
      `Shift-Tab` move the cell with wrap to the next/prev row at the ends, `Home`/`End` jump to the
      first/last column, `Ctrl+Home`/`Ctrl+End` to the first/last cell of the grid, `PgUp`/`PgDn`
      page rows. All clamp to range.
- [ ] **Begin-edit triggers (AR-19)** — `F2` and `Enter` on an editable cell open the editor with the
      caret at end; typing a printable character opens the editor and *replaces* the content.
- [ ] **In-cell editor overlay** — on begin-edit the editor `View` (from RD-03) mounts at the focused
      cell's rect via the RD-01 overlay helper; focus routes to it (`getFocused() === editor`),
      keystrokes land in it, and it is disposed on commit/cancel.
- [ ] **Per-cell immediate commit (AR-02/AR-16)** — on `Enter` while editing, the in-memory record
      updates immediately and `onCommit({rowKey, columnId, value, previous, row})` is invoked; a
      `false`/rejected result reverts to `previous` and keeps the editor open, a `true` result closes
      it and shows the new value.
- [ ] **Enter precedence (AR-18)** — not editing → begin edit (no-op on a read-only cell); editing →
      commit + auto-advance to the same column of the next row.
- [ ] **Cancel** — `Esc` while editing reverts to `previous` and closes the editor without calling
      `onCommit`.
- [ ] **Auto-advance** — `Tab` commits (if editing) then moves to the next cell (wrap to next row);
      `Enter` commits then moves to the next row, same column.
- [ ] **Dirty tracking** — a per-cell dirty flag keyed by `rowKey`+`columnId` (set while a commit is
      pending or a value differs from the source's last-known); a dirty marker (a `•` in the dirty
      theme role) paints on the cell. Exposes `isDirty(rowKey, columnId)` and row/grid rollups.
- [ ] **Read-only columns** — a column with no editor (RD-03) rejects begin-edit; the cursor still
      lands on it for navigation/selection.

### Should Have

- [ ] **Row-editor dialog (form view)** — a `Dialog` auto-built from the column editor specs, bound to
      the row buffer (spike Probe 5's shared spine), opened by double-click / an `editRow` command /
      a configurable key, gated by `Dialog.valid()` on close. *Phase B (AR-27).*
- [ ] Undo/redo of edits. *Deferred — AR-30.*

### Won't Have (Out of Scope)

- The typed editor widgets and value help — RD-03.
- Per-cell / per-row validation and the BeforeSave veto enforcement — RD-12 (this RD provides the
  commit seam; RD-12 layers the gate).
- Row selection gestures — RD-08.

---

## Technical Requirements

### Cell cursor & overlay lifecycle

- `EditableGridRows<T>` overrides `onEvent` to intercept `←`/`→` (move column — the base binds these
  to horizontal scroll), `Home`/`End`/`Ctrl+Home`/`Ctrl+End` (column/grid ends — the base binds
  `Home`/`End` to the first/last *visible row* and ignores `Ctrl`), and `Tab`/`F2`/`Enter`/printable;
  each is handled and **returns before `super.onEvent`** (fall-through would let the base consume it).
  It falls through to the base only for `↑`/`↓`, `PgUp`/`PgDn` paging, and the base's
  `Ctrl+PgUp`/`Ctrl+PgDn` first/last-row jump. It overrides `draw` to overpaint the focused cell and
  the dirty marker after the base row render.
- Editor lifecycle is a small state machine: `idle → editing(cell) → committing → idle`. `editing`
  owns a reactive root (RD-01 overlay helper) holding the editor + its field-binding effects; entering
  `idle` disposes it. `committing` awaits an async `onCommit`; the cell shows dirty until it resolves.
  While `committing` (an in-flight async `onCommit`/`beforeSave`), the cell is **locked**: re-entering
  its editor is blocked and the pending/dirty marker shows until the gate resolves; cursor navigation
  to other cells is allowed, but a second commit for the same cell is serialized after the first
  resolves (no overlapping commits per cell). Full pending/retry UX is RD-12.
- The edit field is a `Signal<string>` seeded from `format(value)` (or the raw string for text
  columns); on commit it is `parse`d (RD-01) to the typed value before `onCommit`.

### Commit flow (per-cell, immediate)

```
beginEdit(cell) → mount editor bound to field
Enter/Tab       → value = parse(field()); previous = column.value(row)
                  applyToRecord(rowKey, columnId, value)   // in-memory, immediate
                  ok = await onCommit({rowKey, columnId, value, previous, row})
                  ok ? closeEditor()+advance() : revert(previous)+keepEditorOpen()
Esc             → revert(previous); closeEditor()          // no onCommit
```

### Keymap (default)

| Key | Not editing | Editing |
|-----|-------------|---------|
| ←/→ | move column | (caret in editor) |
| ↑/↓ | move row | — |
| Tab / Shift-Tab | move cell (wrap) | commit + move cell |
| Home/End · Ctrl+Home/End | col ends / grid ends | — |
| F2 / printable | begin edit | — |
| Enter | begin edit (editable) | commit + next row |
| Esc | — | cancel + revert |

> `←`/`→`, `Home`/`End`, and `Ctrl+Home`/`Ctrl+End` are **reassigned** from the base `GridRows`
> bindings (base: `←`/`→` = horizontal scroll; `Home`/`End` = first/last *visible row* with `Ctrl`
> ignored; base first/last-*row* lives on `Ctrl+PgUp`/`Ctrl+PgDn`), so `EditableGridRows` intercepts
> them and returns before the base handler runs.

---

## Integration Points

### With RD-01
- Consumes `GridColumn` (`value`/`format`/`parse`), `GridDataSource`/`rowKey`, `OnCommit`, and the
  cell-overlay helper.

### With RD-03 (editors)
- `beginEdit` asks RD-03's `createCellEditor(column.editor, field, host)` for the editor `View`;
  `null` (read-only/unsupported) rejects the edit.

### With RD-12 (validation)
- The `onCommit` seam is where RD-12 inserts per-cell validation, the per-row gate, and the BeforeSave
  veto; a rejected validation surfaces as a `false` commit here.

### With RD-08 (selection) / RD-10 (mouse)
- The cursor coexists with row selection (RD-08); mouse click/double-click begin-edit routing is RD-10.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Commit granularity | Per-cell immediate / per-row / batch | Per-cell immediate | Simplest datasheet model; veto governs persistence | AR #2, #16 |
| Enter behavior | Edit-only / commit-only / context-sensitive | Context-sensitive | Avoids overloading; matches datasheet UX | AR #18 |
| Begin-edit | F2 only / +Enter / +type | F2 + Enter + type-replaces | Spreadsheet convention | AR #19 |
| Row dialog | v1 / P2 | P2 | Inline is the v1 primary | AR #27 |
| Undo/redo | v1 / P2 | Deferred | Phase B | AR #30 |

---

## Security Considerations

- **Data sensitivity**: editor holds the caller's cell value in memory only.
- **Input validation**: editor input is validated by the column validator (RD-12) and `parse` before
  commit; this RD defines the `onCommit` seam where that gate runs.
- **Authentication & authorization**: N/A — the host owns auth; the grid never persists except via the
  caller's `onCommit`.
- **Injection risks**: the edit field and its rendered cell text pass the core `sanitize` boundary
  (AR-25); a control byte typed or pasted into the editor cannot reach the terminal raw.
- **Encryption / rate limiting / infrastructure**: N/A (in-process).

---

## Acceptance Criteria

1. [ ] With the cursor on a read-only cell, `Enter` and `F2` are no-ops (no editor mounts); with the
       cursor on an editable cell, `Enter` mounts the editor and `getFocused()` returns that editor.
2. [ ] Typing a printable character on an editable cell begins editing and the field equals that
       character (content replaced), not `previous + char`.
3. [ ] While editing, keystrokes route to the editor (the grid does not move the cursor); `Enter`
       commits and the cursor is on the same column of the next row (`focusedCol` unchanged,
       `focused` = row+1, clamped).
4. [ ] `Esc` while editing restores the cell to `previous` and closes the editor, and `onCommit` was
       NOT called.
5. [ ] A commit calls `onCommit` exactly once with `{rowKey, columnId, value: parse(field), previous,
       row}`; when it resolves `false`, the cell displays `previous` and the editor remains open; when
       `true`, the editor closes and the cell displays the new value.
6. [ ] `Tab` at the last column commits (if editing) and moves to the first column of the next row;
       `Shift-Tab` at the first column moves to the last column of the previous row.
7. [ ] A cell whose pending value differs from the source's last-known value paints the dirty marker
       (`•` in the dirty role); after `onCommit` resolves `true` and the source reflects the value, the
       marker clears; `isDirty(rowKey, columnId)` matches the marker's presence.
8. [ ] The editor overlay mounts within a single cell rect (width = the column width, height = 1) and,
       on close, its reactive root is disposed (no leaked binding effects — owner-disposal assertion).
9. [ ] A `datagrid` kitchen-sink story demonstrates cell navigation + an in-cell edit + commit and
       passes the headless smoke test.
10. [ ] Security verified: a control byte typed into the editor is sanitized in the serialized frame;
        no persistence occurs except through `onCommit`.
