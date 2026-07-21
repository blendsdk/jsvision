# Current State — the RD-02 seam RD-03 extends

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

A grounded read of the code RD-03 grows, cited to `file:line`. Everything below was verified in the working tree
on 2026-07-13.

## The editor seam RD-03 extends (`packages/datagrid/src/cell-editor.ts`)

Shipped by RD-02 (48 lines):

```ts
export interface CellEditorHost { readonly overlay: Group; }               // cell-editor.ts:18

export function createCellEditor<T>(column: GridColumn<T>, field: Signal<string>, _host: CellEditorHost): View | null {
  if (!isEditable(column)) return null;                                    // cell-editor.ts:46
  return new Input({ value: field });                                      // cell-editor.ts:47
}
```

- The seam is **column-based** and returns a text `Input` for an editable column, `null` for read-only. RD-03
  keeps this signature and adds an optional trailing `row?: T` + a `resolveSpec`/`switch` inside (AR #1). The
  `_host.overlay` is already the mount host a richer editor needs to open a sub-popup — no shape change.

## Who calls it, and the editability gate (`packages/datagrid/src/editing.ts`)

`createEditController.beginEdit` (the RD-02 lifecycle) is the sole caller:

```ts
if (tcol === undefined || !isEditable(tcol) || committing.has(cellKey(cell.rowKey, cell.columnId))) return false; // editing.ts:172
const field = signal(seed);                                              // editing.ts:177
const editor = createCellEditor(tcol, field, { overlay: host.overlay }); // editing.ts:178
if (editor === null) return false; // defensive — isEditable already guaranteed an editor  // editing.ts:179
```

- `beginEdit` pre-gates on `isEditable(tcol)` (parse+set) and already treats `createCellEditor(...) === null` as
  "reject begin-edit" (`editing.ts:179`). RD-03 leans on this: `editor: { kind: 'readonly' }` on an otherwise
  editable column makes `createCellEditor` return `null` → the existing guard rejects the edit (AC-5) with **no
  change to the guard**.
- `editing.ts` has `cell.row` in scope, so passing `row` as the new 4th arg to `createCellEditor` (for the
  per-row function form) is a one-line edit (AR #4).
- The editor is mounted inside an editor-host `Group` whose `onEvent` catches Enter/Esc (`editing.ts:180-184`);
  the inner widget is focused via `ev.focusView` (`editing.ts:192`). The commit path reads `field()` through
  `tcol.parse!` (`editing.ts:228`). **RD-03 changes none of this** — the typed widgets simply keep `field`
  authoritative so `parse` still sees the right string.

## The begin-edit key routing (`packages/datagrid/src/editable-grid-rows.ts`)

`tryBeginEdit` (`editable-grid-rows.ts:164-178`) opens on `f2`/`enter`/printable for an editable cell. RD-03
adds one branch: **F4** on an editable cell also begins the edit, flagging the controller to auto-open the
dropdown when the mounted editor is a value-help ComboBox (AR #2). A read-only cell falls through to the base
(`editable-grid-rows.ts:166`), so F4 there is a harmless no-op.

## The column model (`packages/datagrid/src/column.ts`)

`GridColumn<T, V>` (`column.ts:20-40`) carries `id`/`title`/`value`/`format?`/`parse?`/`set?`/`width?`/`align?`.
RD-03 adds one optional field: `editor?: CellEditorSpec | ((row: T) => CellEditorSpec)`. `isEditable`
(`column.ts:96`, parse+set) is unchanged — it stays the editability rule; `editor` only chooses the widget.

## The `@jsvision/ui` widgets RD-03 mounts (all already public on the barrel)

Verified on `packages/ui/src/index.ts` and the option interfaces:

| Kind | Widget | Constructor shape (verified) | Binding signal |
| ---- | ------ | ---------------------------- | -------------- |
| text/integer/decimal | `Input` | `new Input({ value: field, validator? })` | `field: Signal<string>` directly |
| boolean | `CheckGroup` | `{ labels: readonly string[]; value: Signal<boolean[]> }` (`check-group.ts:12`) | `boolBridge(field)` |
| date | `DatePicker` | `{ value: Signal<CalendarDate \| null>; format? }` (`date-picker.ts` opts) | `dateBridge(field)` |
| enum | `ComboBox<string>` | `{ items: Signal<T[]>; getText; value: Signal<T\|null>; editable? }` (`combo-box.ts:35`) | `enumBridge(field)` |
| lookup | `ComboBox<LookupItem>` | same, `getText = it.label`, `editable: false` | `lookupBridge(field, items)` |

Supporting exports (also public): `filter`/`range`/`lookup`/`picture` validators
(`controls/index.ts:27` → `./validators/`), the `Validator` type, core `toISO`/`parseISO`, and the
`CalendarDate` type (`date/index.ts`).

### ComboBox facts that shape the F4 + lookup design

- **Opens on `Down` / `Alt+Down`** while the field (`combo.input`) is focused; `Alt+Down` opens **regardless of
  focus** (`inner.alt`), and a mouse-down on the trailing `▐↓▌` button opens (`combo-box.ts:186-190`).
- `open()` is **protected** and no-ops when `ev.popupHost === undefined` (`combo-box.ts:199-201`) — so RD-03
  forwards the public `Alt+Down` rather than calling `open()` (AR #8).
- Public reads: `combo.input` (the focus target), `combo.text()`, `combo.value()`, `combo.filtered()`
  (used in the ui `combobox.spec.test.ts` oracle).
- Select-only (`editable: false`) binds the **live** `items` signal so an async provider's `items.set(rows)`
  re-renders the open list (`combo-box.ts:204`) — the basis for the async lookup (AR #6).

### Headless popup behavior (drives the AC-6 test harness)

`event-loop.ts:526` — *"`popupHost` is undefined headlessly, so opening a dropdown no-ops"*. A bare
`createEventLoop` cannot open a real popup. The ui `combobox.spec.test.ts:65-67` pattern wires it manually:

```ts
const overlay = new Group(); overlay.state.visible = false;               // full-viewport overlay
loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
// then: popupOpen(overlay) === overlay.state.visible && overlay.children.some(c => c instanceof Group)
```

RD-03's F4 spec reuses exactly this (AR #7).

## The reference decode (not shipped): `packages/spike-data-studio/src/editor-spec.ts`

The spike proved the whole shape against the real widget API: `createCellEditor(spec, field, host)` switching on
kind (`editor-spec.ts:254-286`) + the four `untrack`-guarded bridges (`boolBridge` :190, `dateBridge` :204,
`stringOrNullBridge` :218, `lookupBridge` :232). RD-03 ports the **bridges and the switch body** — but **not
verbatim**: the spike's `lookupBridge` reverse effect is unguarded and clobbers a seeded FK key with `''` on
mount, so RD-03 ports it **with a `if (sel !== null …)` guard** (03-02, PF-001), and the whole editor is
constructed inside the overlay's reactive root (PF-002). RD-03 also does **not**
port the PG-specific `resolveEditors`/introspection (`EditorSpec.kind` derivation from `udtName`) — that stays
in the Data Studio app. The spike is inert reference code; per the documentation standard, no spike/plan/RD
reference appears in the shipped `packages/datagrid/src`.

## Impact summary

| File | Change | Risk |
| ---- | ------ | ---- |
| `cell-editor.ts` | +types, +`resolveSpec`, +widget switch, +`row?` param | Low — additive; ST-15 stays green (default path unchanged) |
| `editor-bridges.ts` | **new** internal module (4 bridges) | Low — ported from the spike, with the `lookupBridge` mount-clobber guard fixed (03-02) |
| `column.ts` | +`editor?` field | Low — optional, additive |
| `editing.ts` | pass `cell.row`; **construct the editor inside `mountCellOverlay`'s `createRoot`** (own the bridge effects); carry the F4 auto-open flag | **Medium** — reorders the begin-edit build/mount seam so factory-time effects are owned |
| `overlay.ts` | `mountCellOverlay` gains a build-callback form so `createCellEditor` runs inside its `createRoot`; returns the built editor for the F4 forward | **Medium** — small lifecycle change; existing disposer path reused |
| `editable-grid-rows.ts` | +F4 begin-edit branch | Low — one `case`/branch beside F2/Enter |
| `index.ts` | re-export the new public types | None |

> **Ownership caveat (drives the `editing.ts`/`overlay.ts` rows above).** Today `createCellEditor` is called at
> `editing.ts:178`, one statement *before* `mountCellOverlay`'s `createRoot` (`overlay.ts:84`) — that root wraps
> only `host.add(view)` + `focusView`, so a factory-time `effect()` created by a bridge would be **unowned**
> (dev-warns, never auto-disposes). RD-02's `Input` never hit this because it binds in `onMount`; the bridges
> are the first eager effects. The restructure moves the `createCellEditor` call inside the root so the bridge
> effects dispose with the overlay. See 03-02 "Ownership".
