# Requirements — Cell Editors & Value Help

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-03](../../requirements/RD-03-cell-editors.md)

This plan implements datagrid **RD-03** additively over the RD-02 editing lifecycle. The requirement text is
authoritative; this document records the **scope delta** the plan realizes and the plan-local decisions
(traced to [00-ambiguity-register.md](00-ambiguity-register.md)).

## What RD-03 adds

RD-02 owns *when* an editor mounts (F2/Enter/printable begin-edit; Enter/Esc commit/cancel; per-cell
write-through). RD-03 owns **which** editor mounts and **how** it binds:

1. **An editor descriptor on the column** — `editor?: CellEditorSpec | ((row: T) => CellEditorSpec)` (AR #1).
2. **Built-in typed editors** — nine kinds mapping to shipped `@jsvision/ui` widgets via typed adapters (AR #4).
3. **A custom-editor factory** — `{ kind: 'custom', create }` returning any `View` bound to the field.
4. **F4 value help** — a `lookup` editor whose dropdown opens on **F4** (begin-edit + open, AR #2).
5. **Field-binding correctness** — every editor reads/writes the single `Signal<string>` edit field; the typed
   bridges keep the string authoritative so RD-02's `parse` produces the right typed value on commit (AR #10).

## In scope

- The `CellEditorSpec` / `CellEditorKind` / `LookupItem` / `LookupProvider` / `CellEditorHost` public types.
- `resolveSpec(column, row)` — literal-or-function → concrete spec; defaults an editable-but-`editor`-less column
  to `{ kind: 'text' }` (backward-compatible with RD-02); `{ kind: 'readonly' }` is an explicit read-only opt-out.
- The `createCellEditor(column, field, host, row?)` widget switch over the nine kinds.
- The four internal typed bridges (`boolBridge`, `dateBridge`, `enumBridge`, `lookupBridge`), each a pair of
  `untrack`-guarded effects created inside the overlay's reactive root.
- Live keystroke `filter` validation per kind (`integer` → `filter('0-9-')`, `decimal` → `filter('0-9.-')`);
  `spec.validator` overrides the default (AR #3).
- F4 = begin-edit + open the value-help dropdown on a `lookup`/`enum` cell (AR #2, AR #8).
- Async lookup provider loading into the ComboBox's live `items` signal (AR #6).
- Kitchen-sink stories for the built-in kinds + the local smoke test (AR #11).
- The RD-03 security ST: a lookup **label** with a control byte renders sanitized; keystroke filter rejects a
  non-conforming character before commit (AR #3, req Security §).

## Out of scope (explicit)

- **Commit-time validation gate + error surfacing** → **RD-12** (RD-03 wires only the live keystroke filter).
- **`datetime` / `json` / `array` rich editors** — not in the `CellEditorKind` union; a later RD. A column that
  wants raw-text editing today omits `editor` and gets the text `Input`.
- **Schema-derived editors** (`resolveEditors` / PG introspection) — the Data Studio app, not this package.
- **The validator model itself** (keystroke-filter / range / lookup validators) — reused from `@jsvision/ui`
  `validators/`; RD-03 only *wires* `filter`.
- **Per-row conditional-editor UX polish** — the function form's *resolution* ships now (trivial); any richer
  per-row-state UX beyond "call the function with the row" is a later concern.
- **Mouse/double-click begin-edit and Tab traversal** → **RD-10** (unchanged from RD-02; PF-001).

## Acceptance criteria (from RD-03 → this plan's ST map)

| AC | Requirement | Realized by |
| -- | ----------- | ----------- |
| AC-1 | `boolean` → `CheckGroup` flipping `'true'`/`'false'`; `date` → `DatePicker` committing ISO `YYYY-MM-DD` | ST-2, ST-3 |
| AC-2 | `enum` → non-editable `ComboBox` listing exactly `spec.values` in order; select 3rd commits that string | ST-4 |
| AC-3 | `lookup` async provider loads, shows the label, writes the **key** on select | ST-5 |
| AC-4 | `custom` returns the caller's `View`; Enter commits (RD-02 protocol), Esc cancels | ST-6 |
| AC-5 | `createCellEditor` returns `null` for `{ kind: 'readonly' }`; RD-02 rejects begin-edit | ST-1 |
| AC-6 | F2/Enter open the type-appropriate editor; F4 on a `lookup` cell opens the popup | ST-7, ST-8 |
| AC-7 | The typed bridges do not loop (asserted via effect-run counts) | ST-9 |
| AC-8 | Kitchen-sink stories cover the built-in kinds + pass the smoke test | ST-10 |
| AC-9 | A lookup label with a control byte renders sanitized; editor input is validator-gated before commit | ST-11 |

See [07-testing-strategy.md](07-testing-strategy.md) for the full input→expected ST cases.
