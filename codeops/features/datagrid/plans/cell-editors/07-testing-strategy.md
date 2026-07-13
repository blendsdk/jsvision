# Testing Strategy — Cell Editors & Value Help

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)
> **Refs**: RD-03 AC-1…AC-9 · the plan's ST-1…ST-11

Spec-first: each `ST-*` is an **immutable oracle** derived from an AC or a plan decision — a failing spec test
means the code is wrong, never the test. Expectations come from the spec, never from imagined behavior. Impl
tests (`*.impl.test.ts`) cover internals/edges. All datagrid tests import `@jsvision/core`/`@jsvision/ui` by name
(built dist), per the RD-01 convention.

## Test harness notes

- **Grid views** need a mounted event loop + a real viewport: `createEventLoop({ width, height }, { caps:
  resolveCapabilities().profile })`, mount a root `Group` holding the grid at an absolute rect,
  `loop.focusView(grid.rows)`, drive `loop.dispatch(...)`. Assert on `loop.getFocused()`, the serialized frame,
  the record, and `grid.isDirty(...)`.
- **Popup-opening ST (F4, lookup label)** additionally wire `loop.popupHost = { overlay, focusView, getFocused }`
  over a full-viewport overlay `Group` (`overlay.state.visible = false` initially) — the ui
  `combobox.spec.test.ts:65-67` pattern — because a bare loop's `popupHost` is `undefined` and a dropdown open
  no-ops headlessly (`event-loop.ts:526`). Helpers: `popupOpen(overlay)` =
  `overlay.state.visible && overlay.children.some(c => c instanceof Group)`; `hostedList(overlay)` finds the
  `ListView` inside the popup frame.
- **Async lookup** uses a resolved `Promise` + `tick = () => new Promise(r => setTimeout(r, 0))` so the
  provider's `items.set(rows)` is observable.
- **Reactivity (no-loop) ST** count effect runs with a counter incremented inside a bare `createRoot`+`effect`
  reader over the bridge signals (effects flush synchronously on write, so no `tick` is needed).

## Specification Test Cases

| ST | AC | Input → Expected | File |
| -- | -- | ---------------- | ---- |
| **ST-1** | 5 | (a) An editable column with **no** `editor` → `createCellEditor(col, field, host)` returns an `Input` (RD-02 backward-compat; ST-15 parity). (b) `editor: { kind: 'readonly' }` on a parse/set column → `createCellEditor` returns `null`, and driving `F2`/`Enter` on that cell mounts **no** editor (`getFocused()` unchanged) and leaves the record untouched. (c) A column without parse/set → `null` regardless of `editor`. | `cell-editor.spec.test.ts` |
| **ST-2** | 1 | A `boolean` column (`value: r.active`, `parse: t => t === 'true'`, `format: v => v?'true':'false'`, `editor: { kind: 'boolean' }`), row `active: false`. `F2` → the mounted editor is a `CheckGroup`. Dispatch `Space` (toggle) then `Enter` → `onCommit` fires with `value` parsing to `true`; the record's `active === true`. Repeat from `true` → commits `false`. | `cell-editor.spec.test.ts` |
| **ST-3** | 1 | A `date` column (`editor: { kind: 'date' }`), field seeded `'2026-07-13'`. `F2` → the editor is a `DatePicker`; its bound value is the `CalendarDate` for 2026-07-13. Commit → the committed string is ISO `'2026-07-13'` (`YYYY-MM-DD`). Seeding an empty field → the picker's value is `null`. | `cell-editor.spec.test.ts` |
| **ST-4** | 2 | An `enum` column (`editor: { kind: 'enum', values: ['open','paid','shipped'] }`). `F2` → a select-only `ComboBox`; its `items()` equal `['open','paid','shipped']` **in order**. Open (`Alt+Down`), move to the 3rd row, `Enter` → `value()/field` becomes `'shipped'`; commit yields `'shipped'`. | `cell-editor.spec.test.ts` |
| **ST-5** | 3 | A `lookup` column (`editor: { kind: 'lookup', items: async () => [{ key:'7', label:'Ada' }, { key:'9', label:'Bo' }] }`). **(a) Empty-seed pick:** field seeded `''`. `F2` → a `ComboBox<LookupItem>`. After `tick()`, `combo.items()` has 2 rows and `getText` of the first is `'Ada'`. Open, pick the row labeled `'Ada'` → `field`/committed value is **`'7'`** (the key), not `'Ada'`. **(b) Existing-key round-trip (PF-001 regression):** field seeded to the **pre-existing key `'7'`** with **no** user interaction. After `tick()` the ComboBox shows label `'Ada'` (the key re-matched once `items` loaded), and commit yields the **unchanged** key `'7'` — proving the seeded FK is **not** clobbered to `''` on mount. | `cell-editor.spec.test.ts` |
| **ST-6** | 4 | A `custom` column (`editor: { kind: 'custom', create: (field) => new Input({ value: field }) }`). `F2` → the mounted editor **is** the caller's `Input`. Type + `Enter` → `onCommit` fires once with the typed value (RD-02 protocol); a fresh edit + `Esc` → the record shows `previous`, `onCommit` **not** called for the cancel. | `cell-editor.spec.test.ts` |
| **ST-7** | 6 | For each of `boolean`/`date`/`enum`/`lookup`/`text`, `F2` (and separately `Enter`) mounts the type-appropriate widget and focus lands on **one pinned target**: for `text`/`boolean`/`date` `getFocused()` **is the mounted widget**; for `enum`/`lookup` (a `ComboBox`) `getFocused() === combo.input` (the ComboBox's only focusable descendant). No "either/or" — each kind asserts exactly one value. | `cell-editor.spec.test.ts` |
| **ST-8** | 6 | With `loop.popupHost` wired: cursor on a `lookup` cell, dispatch `F4` → an editor mounts **and** `popupOpen(overlay) === true` (the value-help dropdown is open in one press). `F4` on a **read-only** cell → no editor, `popupOpen === false`. | `cell-editor.spec.test.ts` |
| **ST-9** | 7 | For `boolBridge`/`dateBridge`/`enumBridge`/`lookupBridge`: setting the string `field` **once** programmatically updates the control signal exactly once and does **not** re-trigger a `field` write (a field-write counter stays at its post-seed value; the control-reader effect runs once per real change, not in a loop). | `editor-bridges.impl.test.ts` |
| **ST-10** | 8 | The `editors` story is registered (unique id `'datagrid/editors'` + required metadata) and paints headlessly; the existing `editing` story still passes. | `kitchen-sink.smoke.spec.test.ts` |
| **ST-11** | 9 | (a) A `lookup` provider returns `label: 'A\x1b[31mB\x07'`; mount + open (wired `popupHost`) + render → no buffer cell is `\x1b`/`\x07` and `serialize()` has no `\x07`. (b) An `integer` editor (`filter('0-9-')`): dispatch a letter keystroke → the buffer rejects it (`field()` unchanged); commit yields only filter-conformant text. | `security.spec.test.ts` |

## AC → ST coverage map

| AC | Covered by |
| -- | ---------- |
| AC-1 boolean CheckGroup flips true/false; date DatePicker commits ISO | ST-2, ST-3 |
| AC-2 enum lists values in order; select 3rd commits it | ST-4 |
| AC-3 lookup async load, shows label, writes key | ST-5 |
| AC-4 custom returns caller's View; Enter commits, Esc cancels | ST-6 |
| AC-5 readonly → null → begin-edit rejected (+ backward-compat text default) | ST-1 |
| AC-6 F2/Enter open type-appropriate editor; F4 opens lookup popup | ST-7, ST-8 |
| AC-7 typed bridges don't loop (effect-run counts) | ST-9 |
| AC-8 kitchen-sink stories cover built-in kinds + smoke | ST-10 |
| AC-9 lookup label sanitized; editor input validator-gated before commit | ST-11 |

## Impl test coverage (`*.impl.test.ts`)

- **`resolveSpec`** — the per-row function form (`editor: (row) => row.locked ? { kind:'readonly' } : { kind:'text' }`)
  resolves per row; `undefined` row falls back to text; a literal spec passes through.
- **`editor-bridges`** — each bridge round-trips both directions; the `'' ⟷ null` (enum) and key⟷item (lookup)
  mappings; the `field → sel` re-match after an async `items` repopulation.
- **`createCellEditor` dispatch** — every kind returns the expected widget class (or `null`); `spec.validator`
  overrides `defaultValidator`; the `custom` factory receives the same `field` + `host`.
- **F4 forward** — `openDropdown` on a non-ComboBox editor (text/date) is inert (no throw, editor mounts).
- **ComboBox focus target** — Phase-4 authoring confirms `ev.focusView(editor)` on a `ComboBox` lands on
  `combo.input` (the only focusable descendant); if it does not, the editing controller focuses `combo.input`
  explicitly for ComboBox editors so ST-7's pinned target holds.

## Verify commands

- **Inner loop (red/green):** `yarn workspace @jsvision/datagrid test <spec-file>`.
- **Phase gate:** `yarn workspace @jsvision/datagrid typecheck`, then `… test`, then `… check:docs` — run
  **separately** (one script per `yarn workspace`; the combined form trips TS5042).
- **Done gate:** full `yarn verify` (the `@jsvision/ui` `editor-perf` 16 ms ceiling may be excluded via
  `TUI_SKIP_PERF=1` per `CLAUDE.md` — it never gates and passes in isolation).
