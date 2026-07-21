# 03-03 — Lookup, F4 Value Help & Showcase

> **Document**: 03-03-lookup-f4-and-showcase.md
> **Parent**: [Index](00-index.md)
> **Owns**: the async lookup editor build, the F4 begin-edit-and-open gesture (across `editable-grid-rows.ts` +
> `editing.ts`), and the kitchen-sink stories + security ST. `createCellEditor` (03-01) delegates the `lookup`
> case here; the bridges live in 03-02.

## 1. The lookup editor (`cell-editor.ts`) — async provider (AR #6, AR #9)

```ts
function buildLookupEditor(spec: CellEditorSpec, field: Signal<string>): View {
  const items = signal<LookupItem[]>([]);
  const provider = spec.items;
  if (Array.isArray(provider)) items.set([...provider]);          // static list — seed immediately
  else if (typeof provider === 'function') void provider().then((rows) => items.set(rows)); // async — load once
  return new ComboBox<LookupItem>({
    items, getText: (it) => it.label, value: lookupBridge(field, items), editable: false,
  });
}
```

- **Select-only** (`editable: false`) binds the live `items` signal, so when the async provider resolves the
  open list re-renders and the current key re-matches its label (`combo-box.ts:204`, 03-02 `lookupBridge`).
- The field holds the **key**; the ComboBox shows the **label**; selecting writes the key (AC-3, req AR-32).
- `void provider().then(...)` is fire-and-forget by design (RD-03 loads once on mount); a rejected promise
  leaves `items` empty (an empty dropdown), never throws into the render loop. The lookup provider's query is
  the caller's responsibility and must be parameterized server-side — the grid only consumes `LookupItem[]`
  (req Security §).

## 2. F4 = begin-edit + open the dropdown (AR #2, AR #8)

### 2a. `editable-grid-rows.ts` — the F4 branch

`tryBeginEdit` (`editable-grid-rows.ts:164`) gains an F4 case beside F2/Enter:

```ts
if (inner.key === 'f2' || inner.key === 'enter') { this.controller.beginEdit(ev); return true; }
if (inner.key === 'f4') { this.controller.beginEdit(ev, { openDropdown: true }); return true; }  // NEW
```

- F4 on an editable cell begins the edit; a read-only cell still falls through to the base
  (`editable-grid-rows.ts:166` gate), so F4 there is a no-op.

### 2b. `editing.ts` — forward the public open key

`beginEdit`'s options gain `openDropdown?: boolean`. After the editor is mounted **and focused** (the existing
`mountCellOverlay` + `ev.focusView(editor)` path), when `openDropdown` is set and the mounted editor is a
`ComboBox`, forward a synthetic `Alt+Down` to its public `onEvent`. (Per the reactive-ownership restructure in
02-current-state, the `editor` reference now comes back from `mountCellOverlay`'s build callback — the editor is
constructed inside the overlay's `createRoot` — rather than from a pre-mount local; the forward is unchanged
otherwise.)

```ts
if (opts?.openDropdown && editor instanceof ComboBox) {
  editor.onEvent({ ...ev, event: { type: 'key', key: 'down', ctrl: false, alt: true, shift: false }, handled: false });
}
```

- The synthetic envelope **reuses the real `ev`'s `popupHost`/`focusView`** (spread from `ev`), so the ComboBox
  opens through its own public trigger (`combo-box.ts:188`, opens on `inner.alt`). `ComboBox.open()` — protected
  — is never touched (AR #8). Headlessly the open no-ops unless `loop.popupHost` is wired (see the test harness).
- `enum` cells (also a `ComboBox`) get the same F4 affordance for free; `text`/`date`/`custom` cells simply
  begin-edit (the `instanceof ComboBox` guard skips the open) — a harmless generalization.

> **Import note:** `editing.ts` imports `ComboBox` from `@jsvision/ui` for the `instanceof` guard. This keeps the
> forward at the lifecycle layer (which already owns begin-edit) rather than leaking a datagrid concern into
> `cell-editor.ts`.

## 3. Kitchen-sink stories (AR #11) — the showcase gate

Extend the in-package harness (`packages/datagrid/test/kitchen-sink/stories/`) with stories exercising the
built-in kinds beside the existing text `editing` story:

- **`editors.story.ts`** — a `Story` (`id: 'datagrid/editors'`) with a small fixture whose columns use
  `editor: { kind: 'boolean' }`, `{ kind: 'date' }`, `{ kind: 'enum', values }`, and
  `{ kind: 'lookup', items }`. A visible bound-state echo (a `Text(() => …)`) shows the last committed cell.
  Interaction hints: "F2/Enter edit · F4 = value help on Customer".
- Register with one import + one array entry in `stories/index.ts` (the story contract).
- The existing `kitchen-sink.smoke.spec.test.ts` covers it mechanically: unique id, required metadata, paints
  headlessly. (The lookup dropdown's live open needs a shell; the smoke test asserts the story *mounts and
  paints*, not the popup — the popup open is asserted in the F4 ST with a wired `popupHost`.)

## 4. Security ST (AR #3, req Security §) — `security.spec.test.ts`

Two clauses of AC-9, added to the existing datagrid security spec:

1. **Lookup label sanitized at the frame** — a `lookup` provider returns `{ key: '7', label: 'A\x1b[31mB\x07' }`;
   mount + open the dropdown (wired `popupHost`) + render; assert no buffer cell holds a raw `\x1b`/`\x07` and
   the serialized frame contains no `\x07` (the core `sanitize` boundary at render, AR-25/26). A malicious label
   cannot inject control bytes.
2. **Keystroke filter gates before commit** — an `integer` editor with `filter('0-9-')`: dispatch a letter
   keystroke into the editor; the buffer does not accept it (`field()` unchanged); commit yields the
   filter-conformant value only. (Commit-time `valid()` gating is RD-12, not asserted here.)

## 5. Testability seam recap (drives the ST harness, AR #7)

The F4-open and lookup-label ST wire `loop.popupHost = { overlay, focusView, getFocused }` over a full-viewport
overlay `Group` (the `combobox.spec.test.ts:65-67` pattern) and assert `popupOpen(overlay)` /
`hostedList(overlay)`. This overlay is **separate** from the grid's own editor-mount overlay (`grid.overlay`);
the ComboBox opens its list into `loop.popupHost.overlay`, exactly as in the app shell.
