# RD-16: Column & Variant Personalization Dialog

> **Document**: RD-16-personalization-dialog.md
> **Status**: Draft
> **Created**: 2026-07-18
> **Project**: @jsvision/datagrid — enterprise-class editable data grid (TUI)
> **Depends On**: RD-07, RD-13
> **CodeOps Skills Version**: 3.8.0

---

## Feature Overview

An end-user **personalization dialog** — the interactive UI that lets the *person using* a TUI app
reshape a grid's columns and manage saved layouts, without the app developer hand-building a bespoke
screen. It is the terminal-native equivalent of SAP ALV's *Change Layout / Manage Layouts* dialog.

RD-07 gave the grid its column-layout **API** (show/hide, reorder, resize, freeze) and RD-13 added the
serializable-**variant** API (`saveVariant`/`applyVariant`, `setFrozen`) — but both are *programmatic*:
only the app developer can call them. RD-16 puts a modal `Dialog` on top of those APIs so end users can
toggle column visibility, reorder and freeze columns, set widths, and save/apply/delete/default named
layout **variants** at runtime. The grid stays stateless about persistence (RD-13's contract): the app
supplies a `VariantStore` the dialog reads and writes. Shipped as a reusable widget in
`@jsvision/datagrid` and opened with one async helper, `personalizeGrid(grid, opts)`.

This is a Phase-B enhancement — it does not gate the v1 datasheet; it is the enterprise-parity follow-up
that turns the RD-07/RD-13 machinery into a self-serve end-user experience.

---

## Functional Requirements

### Must Have

- [ ] **Open as an async modal** — `personalizeGrid(grid, opts)` opens a modal dialog over the grid and
      resolves when the dialog closes with `{ ok: true }` (OK, changes applied) or `{ ok: false }`
      (Cancel/Esc, grid untouched). ([AR-46](00-ambiguity-register.md))
- [ ] **Staged apply** — all edits mutate a *pending* layout held by the dialog, **not** the live grid;
      **OK** commits the pending layout to the grid in one step (via `grid.applyVariant`), **Cancel/Esc**
      discards it and leaves the grid exactly as it was. ([AR-43](00-ambiguity-register.md),
      [AR-55](00-ambiguity-register.md))
- [ ] **Show / hide columns** — a per-column visibility toggle in the dialog's column list; a hidden
      column stays in the list (so it can be re-shown) and drops from the grid's visible order on OK.
      The last visible column cannot be hidden — its toggle is disabled while exactly one column remains
      visible (a grid with zero visible columns is never committed). ([AR-44](00-ambiguity-register.md),
      [PF-027](00-preflight-report.md))
- [ ] **Reorder columns** — move the selected column up or down in the list (keyboard `Alt+↑`/`Alt+↓`
      and on-screen buttons); the new order is the grid's display order on OK. ([AR-44](00-ambiguity-register.md),
      [AR-51](00-ambiguity-register.md))
- [ ] **Freeze columns** — set each column's freeze side to left / right / none; on OK the grid re-pins
      via `setFrozen`. The existing over-pin guard still applies (a freeze wider than the viewport peels
      the innermost frozen column back to the scrolling center; a dev warning fires only when *every*
      column would be frozen). ([AR-44](00-ambiguity-register.md), [PF-028](00-preflight-report.md))
- [ ] **Set column width** — set an explicit per-column width (a numeric field), clamped to the
      column's `[minWidth, maxWidth]` on OK (as `setColumnWidth` does); clearing the field returns the
      column to auto width (no override), committed via the new `grid.clearColumnWidth(id)`.
      ([AR-44](00-ambiguity-register.md), [PF-024](00-preflight-report.md))
- [ ] **Reset to defaults** — a Reset action restores the *pending* layout's column facets to the grid's
      construction-time column layout (read via the new `grid.defaultColumnLayout()`): every column
      visible, in the order the columns were passed at construction, no freeze, no width overrides. It
      resets only the column facets — pending's sort and filter are left untouched, so Reset does **not**
      touch the grid's sort or filter. ([AR-52](00-ambiguity-register.md), [PF-024](00-preflight-report.md))
- [ ] **Save the current layout as a named variant** — a Save-as action names the *pending* layout and
      writes it to the `VariantStore` as a `GridVariant` — every facet (`columns`/`freeze`/`sort`/`filter`)
      taken from the pending layout. (Pending owns sort/filter from open onward: seeded from the live grid
      at open, and changed only by applying a saved variant — see the sort/filter rule under *Won't Have*.)
      A blank/whitespace-only name is rejected; a name colliding with an existing variant prompts
      **confirm-overwrite** (yes replaces, no returns to name entry). ([AR-45](00-ambiguity-register.md),
      [AR-49](00-ambiguity-register.md), [AR-55](00-ambiguity-register.md), [AR-56](00-ambiguity-register.md),
      [PF-025](00-preflight-report.md))
- [ ] **Apply a saved variant** — selecting a variant from the store's list replaces the *pending* layout
      wholesale (columns, freeze, sort, filter); the dialog's column list re-renders to reflect it. The
      grid changes only on OK (staged). Unknown column ids in the variant are skipped, not thrown (RD-13
      `applyVariant` behavior). ([AR-45](00-ambiguity-register.md))
- [ ] **Delete a saved variant** — remove the selected variant from the store (with a confirm prompt).
      Deleting the variant currently marked default clears the store's default (`getDefault()` returns
      `undefined` afterward). ([AR-45](00-ambiguity-register.md), [PF-026](00-preflight-report.md))
- [ ] **Mark a default variant** — flag one saved variant as the default; the store persists which one.
      The dialog does **not** auto-apply it — applying the default on grid load is the app's job
      (`store.getDefault()` + `grid.applyVariant`). ([AR-45](00-ambiguity-register.md),
      [AR-50](00-ambiguity-register.md))
- [ ] **Public `grid.columns()` accessor** — a reactive accessor returning the full column list
      (hidden included, in full order) with each column's `id`, `title`, `visible`, `frozen`
      (`'left'|'right'|'none'`), and resolved `width`; the dialog reads it to render, and apps may use it
      for their own column UIs. ([AR-48](00-ambiguity-register.md))
- [ ] **Caller-provided `VariantStore`** — the dialog reads/writes variants only through a store the app
      passes (`list`/`save`/`delete`/`setDefault`/`getDefault`); the grid holds no variant registry.
      ([AR-47](00-ambiguity-register.md))
- [ ] **Fully keyboard-operable** — Tab/Shift+Tab move between controls, arrows move within the column
      list, Space toggles the selected column's visibility, Enter = OK, Esc = Cancel; no gesture requires
      a mouse. ([AR-57](00-ambiguity-register.md))
- [ ] **Kitchen-sink story + showcase demo** — a datagrid-local kitchen-sink story and a
      `datagrid-showcase` demo exercise the dialog (per the NON-NEGOTIABLE kitchen-sink gate).

### Should Have

- [ ] **Visible-count echo** — a live readout such as `4 of 6 columns visible` updates as toggles change.
- [ ] **Mouse parity** — clicking a checkbox / button / list row works alongside the keyboard path
      (clicking is a convenience; the keyboard path is authoritative).

### Won't Have (Out of Scope)

- **Live-preview apply** — rejected in favor of staged OK/Cancel ([AR-43](00-ambiguity-register.md)).
- **Auto-apply the default variant on grid load** — the app applies it; the dialog only flags it
  ([AR-50](00-ambiguity-register.md)).
- **Drag-to-reorder inside the dialog** — the header already offers mouse drag-reorder (RD-07); the
  dialog uses move up/down ([AR-51](00-ambiguity-register.md)).
- **Column-list search / type-to-filter** — deferred to a later pass; v1 shows a scrollable list
  ([AR-53](00-ambiguity-register.md)).
- **Sort/filter *editing controls*** — the dialog has no sort/filter widgets; sort/filter are set via the
  header (RD-05/RD-06). The dialog seeds the pending layout's sort/filter from the live grid at open and
  carries them into saved variants. It never *edits* them directly — but **applying a saved variant does
  restage its sort/filter** (part of "replaces the pending layout wholesale"), so pressing OK after
  applying a variant reproduces that variant's sort/filter on the grid. Absent an applied variant, OK
  leaves the grid's sort/filter as they were. ([PF-025](00-preflight-report.md))
- **CSV import / paste-append** — a separate deferred RD-13 item, unrelated to this dialog.
- **Grouping / pivot column management** — out of the datagrid scope entirely (register AR-05).

---

## Technical Requirements

### Public read accessor — `grid.columns()`

A new reactive accessor on `EditableDataGrid<T>` exposing column metadata the dialog needs (the grid's
`columnMap` is private — the RD-13 plan's Gap 1, "no public column-metadata accessor"). It composes the
grid's existing layout state (`columnOrderSig`, `hidden`, the resolved freeze partition, and the
`columnWidths` overrides) with each column's `title`.

```ts
/** Read-only column metadata for a personalization UI. */
export interface GridColumnInfo {
  readonly id: string;
  readonly title: string;
  readonly visible: boolean;                     // !hidden.has(id)
  readonly frozen: 'left' | 'right' | 'none';    // from frozen() membership
  readonly width: number;                        // resolved width in cells (columnWidth(id))
}

class EditableDataGrid<T> {
  /** The full column list (all ids, hidden included), in full column order. Reactive. */
  columns(): readonly GridColumnInfo[];
}
```

- **Reactive**: reading it inside an effect re-runs when order / visibility / freeze / width change.
- **Full order, hidden included** — distinct from `columnOrder()` (visible-only). This is the read
  surface the dialog renders; it adds no *write* surface (the RD-07/RD-13 setters remain the write path).
- **`frozen` reports the *resolved* partition** — like `grid.frozen()`, a column pinned wider than the
  viewport is over-pin-folded back to the center and reports `frozen: 'none'`. A consequence (PF-028): if a
  grid was constructed with more frozen columns than fit, opening the dialog and pressing OK re-commits the
  narrowed (resolved) freeze, dropping the over-pinned intent. Accepted as a v1 limitation — the modal
  covers the grid and over-pin is viewport-dependent regardless. ([PF-028](00-preflight-report.md))

### Reset & width-clear affordances

The staged **Reset** and the width editor's clear-to-auto need grid surface the RD-07/RD-13 API does not
yet provide (found in preflight, [PF-024](00-preflight-report.md)). Three small additions to
`EditableDataGrid<T>`, all data-plane — no new engine/core primitives:

```ts
class EditableDataGrid<T> {
  /**
   * The construction-time column layout, in the same shape as `columns()`: every column visible, in the
   * order passed at construction, no freeze, no width overrides. The dialog seeds Reset's pending column
   * facets from this (pending's sort/filter are left untouched). The grid already retains construction
   * order and declared widths privately.
   */
  defaultColumnLayout(): readonly GridColumnInfo[];

  /** Remove a column's explicit width override, returning it to auto/declared width. Unknown id ignored. */
  clearColumnWidth(id: string): void;
}
```

- **`applyVariant` width semantics — corrected.** Today `applyVariant` only *adds* the width overrides a
  variant names; it never removes one the variant omits, so a pending "no width overrides" layout cannot be
  committed and the width-clear path silently no-ops. `applyVariant`/`resolveVariant` are corrected so that,
  for each **named** column, the override is *cleared* unless the variant carries a width (delete-then-set).
  This also repairs a latent round-trip bug in the shipped RD-13 `saveVariant`→`applyVariant` path (a
  cleared width did not restore), so it ships with an RD-13 regression test alongside the RD-16 work.

### Caller-provided persistence — `VariantStore`

```ts
/** The app-provided store the dialog reads and writes variants through. The grid holds no registry. */
export interface VariantStore {
  /** All saved variants, newest-or-app-ordered. A synchronous snapshot the dialog renders. */
  list(): readonly GridVariant[];
  /** Insert or overwrite by `variant.name`. */
  save(variant: GridVariant): void;
  /** Remove the variant with this name (no-op if absent). If it was the default, the default is cleared. */
  delete(name: string): void;
  /** Mark the named variant the default (persisted by the store). */
  setDefault(name: string): void;
  /** The default variant's name, or `undefined` when none is set. */
  getDefault(): string | undefined;
}
```

- **Synchronous contract** — `list()`/`getDefault()` return the current in-memory snapshot; the app may
  back the store with a file / DB and hydrate it before opening the dialog. `save`/`delete`/`setDefault`
  return `void` (the app persists behind them); the dialog re-reads `list()` after each mutation.
- A reference **in-memory implementation** ships for the showcase/tests (an array + a default name;
  `delete` clears the default name when it removes the default variant); real persistence is the app's
  responsibility (keeps the package zero-dependency).

### The open helper — `personalizeGrid`

```ts
export interface PersonalizeOptions {
  /** The variant store the dialog reads/writes. */
  readonly store: VariantStore;
  /** The modal host the dialog mounts into (the app's `ModalDialogHost`, as formDialog/openFile use). */
  readonly host: ModalDialogHost;
  /** Optional dialog title (default e.g. `'Personalize columns'`). */
  readonly title?: string;
}

/** The dialog outcome: `ok` is true when the user pressed OK (the pending layout was applied). */
export interface PersonalizeResult {
  readonly ok: boolean;
}

export function personalizeGrid<T>(
  grid: EditableDataGrid<T>,
  opts: PersonalizeOptions,
): Promise<PersonalizeResult>;
```

- Mirrors `@jsvision/forms`' `formDialog()` and `@jsvision/files`' `openFile()`: it creates, mounts,
  owns, and disposes the modal, and resolves a promise on close. The app wires it to a menu item / a
  keybinding; the datagrid ships **no** default keybinding.

### Dialog structure (composition, not new primitives)

Built from existing `@jsvision/ui` widgets — `Dialog` (with `okCancelButtons`), `ListView`/`ListBox`
(the column list), `CheckGroup`/checkbox glyphs (visibility), `Button` (move up/down, Save-as, Apply,
Delete, Set-default, Reset), `Input` (variant name, width), and a nested `confirm()` for
overwrite/delete prompts. No new engine or core primitives.

- **Pending model** — on open the dialog seeds a pending `GridVariant` from `grid.saveVariant('(current)')`
  (its columns/freeze from `grid.columns()`, its sort/filter from the live grid — the one and only read of
  the live grid's sort/filter). All edits mutate this pending variant; the live grid is untouched until OK.
  Applying a saved variant replaces the whole pending variant, including its sort/filter.
- **Two regions** — (1) a **column list** (one row per column: visibility toggle · title · freeze
  side · width) with move up/down; (2) a **variants panel** (the store's `list()` with Save-as / Apply /
  Delete / Set-default) plus **Reset**. OK / Cancel at the bottom.
- **On OK** — `grid.applyVariant(pending)` commits order/visibility/width/freeze and re-applies pending's
  sort/filter in one pass — equal to the grid's current sort/filter unless a saved variant was applied,
  which restages that variant's sort/filter. `applyVariant` clears a width override the pending layout no
  longer carries (see *Reset & width-clear affordances*). The promise resolves `{ ok: true }`.

### Complexity

**M** — a UI dialog composing existing widgets over the RD-07/RD-13 APIs, plus a reactive read accessor
(`columns()`), the small `VariantStore` seam, and a few data-plane grid additions found in preflight
(`defaultColumnLayout()`, `clearColumnWidth()`, and a corrected `applyVariant` width-restore — PF-024). No
new rendering, layout, or reactive primitives.

---

## Integration Points

### With RD-07 (Columns & Layout)
- The dialog is the end-user front-end to RD-07's `setColumnVisible` / `setColumnOrder` /
  `setColumnWidth` / freeze partition. It reads current state via the new `grid.columns()` (and the
  construction-time baseline via `grid.defaultColumnLayout()`) and commits through `applyVariant` (which
  routes to the same private layout signals). RD-16 adds `grid.clearColumnWidth(id)` and corrects
  `applyVariant`'s width-restore so an override can be *removed*, not only set
  ([PF-024](00-preflight-report.md)).

### With RD-13 (Export, Import & Personalization)
- Builds directly on RD-13's `GridVariant` schema, `saveVariant` / `applyVariant`, and runtime
  `setFrozen`. Honors RD-13's grid-stays-stateless-about-persistence decision by requiring a caller
  `VariantStore` (RD-13 AR #10). This RD *extracts and elaborates* RD-13's deferred "Personalization
  dialog" Should-Have ([AR-42](00-ambiguity-register.md)).

### With RD-14 (Non-Functional)
- Inherits the keyboard-operability, theme-role, security-sanitize, and test-tier obligations; adds no
  new core theme roles (reuses the `Dialog` roles).

### With `@jsvision/ui` (Dialog family)
- Composes `Dialog` + `ModalDialogHost` + list/control widgets; the same modal seam `formDialog` /
  `FileDialog` use.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Document organization | New RD-16 / elaborate within RD-13 | New RD-16 | RD-13 shipped its slice; the dialog is a distinct, sizeable capability | [AR-42](00-ambiguity-register.md) |
| Apply model | Staged (OK/Cancel) / live-preview | Staged | A modal can cover the grid; staged matches formDialog/FileDialog and avoids flicker | [AR-43](00-ambiguity-register.md) |
| Column ops in v1 | show/hide + reorder / + freeze / + width | All four | User chose the fuller set; all four APIs now exist | [AR-44](00-ambiguity-register.md) |
| Variant management | Full / minimal / defer | Full (save/apply/delete/default) | The headline reason for the dialog | [AR-45](00-ambiguity-register.md) |
| Open API | Async helper / class / both | `personalizeGrid()` async helper | Least wiring; mirrors formDialog/openFile | [AR-46](00-ambiguity-register.md) |
| Variant persistence | Caller `VariantStore` / in-memory seeded list | Caller `VariantStore` | Consistent with RD-13's stateless-grid contract | [AR-47](00-ambiguity-register.md) |
| Column-metadata read | Public `grid.columns()` / keep private | Public `grid.columns()` | Clean reusable read surface; the helper needs it | [AR-48](00-ambiguity-register.md) |
| Name collision | Confirm overwrite / silent / reject | Confirm overwrite | Safe and explicit | [AR-49](00-ambiguity-register.md) |
| Default semantics | Store flag; app applies / auto-apply | Store flag; app applies on load | No grid load-time hook needed; less surface | [AR-50](00-ambiguity-register.md) |
| Reorder mechanism | Move up/down / drag | Move up/down | Keyboard-idiomatic + accessible; drag exists in the header | [AR-51](00-ambiguity-register.md) |
| Reset action | Include / omit | Include "Reset to defaults" | Cheap, expected (SAP "Default layout") | [AR-52](00-ambiguity-register.md) |
| Column search | Defer / v1 | Defer | Keeps v1 focused; list scrolls | [AR-53](00-ambiguity-register.md) |
| Package | `@jsvision/datagrid` / new pkg | `@jsvision/datagrid` | Datagrid-specific; already on ui; stays zero-dep | [AR-54](00-ambiguity-register.md) |
| Save captures | Pending (staged) layout / live grid | Pending layout | The staged model makes the live grid stale until OK | [AR-55](00-ambiguity-register.md) |
| Name validation | reject empty + sanitize + cap 64 | reject empty + sanitize + cap 64 | Security/data default (non-negotiable sanitize) | [AR-56](00-ambiguity-register.md) |
| A11y / theming | keyboard-only + reuse Dialog roles | keyboard-only + reuse Dialog roles | Per RD-14; no new core theme roles | [AR-57](00-ambiguity-register.md) |

> **Traceability:** Every scope decision references its Ambiguity Register entry. See `00-ambiguity-register.md`.

---

## Security Considerations

> **🚨 MANDATORY.** See the project's security coding standards (CLAUDE.md).

- **Data sensitivity**: none intrinsic — the dialog manipulates column layout + variant names, not row
  data. A caller `VariantStore` may persist variants (column ids, sort/filter operands) to disk/DB; that
  storage's security is the app's responsibility.
- **Input validation**: the **variant name** is the only free-text input — it is trimmed and rejected
  when empty/whitespace-only, `sanitize`d (control bytes stripped, per the SDK egress boundary) before it
  is displayed or stored, and capped at **64 characters** ([AR-56](00-ambiguity-register.md)). The
  **width** input accepts digits only and is clamped to the column's `[minWidth, maxWidth]`.
- **Injection risks**: none new — names/labels are rendered as text through the core `sanitize` boundary
  (no markup/terminal-escape path); a variant restored from an untrusted store with unknown column ids is
  skipped, not executed (RD-13 `applyVariant` drop-unknown), and its filter operands are structured
  literals (never concatenated into a query by the grid).
- **Authentication & authorization**: n/a (a local UI); who may personalize is the app's concern.
- **Encryption / rate limiting / infrastructure**: n/a for the widget; any persistence layer is the app's.

---

## Acceptance Criteria

1. [ ] `personalizeGrid(grid, { store, host })` mounts a modal and returns a `Promise<{ ok: boolean }>`
       that resolves `{ ok: true }` after **OK** and `{ ok: false }` after **Cancel** or **Esc**; after a
       Cancel/Esc, `grid.columns()` is byte-for-byte identical to before the call (staged model — the grid
       was never touched).
2. [ ] Hiding a column in the dialog and pressing OK removes it from `grid.columnOrder()`; the column is
       still present in `grid.columns()` with `visible: false`. Re-opening the dialog and re-showing it +
       OK restores it to `grid.columnOrder()`. The last visible column's visibility toggle is disabled — a
       zero-visible-columns layout is never committed.
3. [ ] Moving a column up/down N times and pressing OK yields `grid.columnOrder()` equal to the reordered
       sequence; a column at the top does not move up, and one at the bottom does not move down (boundary).
4. [ ] Setting a column's freeze to `left` (or `right`) + OK makes it appear in `grid.frozen().left` (or
       `.right`); setting it to `none` + OK removes it from both.
5. [ ] Setting a width of `1` on a column with `minWidth: 4` + OK yields `grid.columnWidth(id) === 4`
       (clamped up); a width of `999` on a column with `maxWidth: 40` yields `40` (clamped down); clearing
       the width field + OK removes the override (via `grid.clearColumnWidth`), so `grid.columnWidth(id)`
       returns to the column's auto/declared width.
6. [ ] **Reset** + OK restores every column visible, in construction order, with `grid.frozen()` empty and
       no width overrides — a width override set before Reset is **cleared** by the commit (verifying the
       corrected `applyVariant` width-restore); the grid's `sort()` and `filterModel()` are unchanged by Reset.
7. [ ] Save-as with name `"mine"` writes a `GridVariant` to the store (`store.list()` contains one whose
       `name === 'mine'`) whose `columns`/`freeze`/`sort`/`filter` all reflect the **pending** layout
       (equal to the grid's at open, absent an applied variant; equal to an applied variant's after one is
       applied). A blank name is rejected (nothing written); a name already in the store triggers a
       confirm-overwrite prompt (declining leaves the store unchanged).
8. [ ] Applying a saved variant re-renders the dialog's column list to that variant, and pressing OK makes
       `grid.columnOrder()`/`frozen()`/`sort()`/`filterModel()` reproduce it; an unknown column id in the
       variant is skipped without throwing.
9. [ ] Deleting the selected variant (after its confirm) removes it from `store.list()`; deleting the
       variant currently marked default also clears the default (`store.getDefault()` returns `undefined`);
       marking a variant default makes `store.getDefault()` return its name, and the grid layout does
       **not** change as a result (no auto-apply).
10. [ ] `grid.columns()` returns one entry per column in full construction/display order (hidden included),
        each with the correct `id`, `title`, `visible`, `frozen` (`'left'|'right'|'none'`), and resolved
        `width`; reading it inside an effect re-runs when a column is hidden/shown/reordered/frozen/resized.
11. [ ] The dialog is fully operable with the keyboard alone: Tab/Shift+Tab cycle controls, ↑/↓ move the
        list selection, Space toggles the selected column's visibility, `Alt+↑`/`Alt+↓` reorder, Enter =
        OK, Esc = Cancel — asserted headlessly with dispatched key events (no mouse).
12. [ ] A variant name containing control bytes (e.g. `"a\x1bb"`) renders sanitized (no raw ESC/BEL in the
        frame) and is stored sanitized; the name field is hard-capped at 64 characters — input beyond 64 is
        prevented at entry (truncated), never a longer stored value.
13. [ ] A datagrid-local kitchen-sink story and a `datagrid-showcase` demo mount headlessly and paint
        (kitchen-sink smoke gate); the package remains zero-runtime-dependency (`check:deps`).
14. [ ] Security requirements verified: variant-name sanitize + length cap + empty-rejection; width
        digit-filter + clamp; unknown-column-id skip on apply; no new core theme roles.
15. [ ] `CI=1 yarn verify` green; no RD-01…15 regression.
