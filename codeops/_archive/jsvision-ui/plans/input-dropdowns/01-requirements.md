# Requirements: Input Dropdowns (History · ComboBox)

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-14](../../requirements/RD-14-input-dropdowns.md)

## Feature Overview

Two controls that pair a text field with a drop-down list, sharing one non-modal anchored-popup
primitive generalized from the RD-05 menu overlay:

- **`History`** — faithful re-creation of TV `THistory`: a `▐↓▌` button linked to an `Input`,
  dropping down a bounded MRU list of that field's past values; a pick replaces + selects the field.
- **`ComboBox<T>`** — new (no TV counterpart): an `Input` + drop-down `ListView<T>`, editable
  (free text + filter-as-you-type) or select-only (picker + type-ahead), drawn like its TV siblings.

Behavior may extend TV (reactive two-way binding, generic `ComboBox<T>`, filter-as-you-type,
non-modal popup, Alt+Down); the **drawing/geometry/color must match TV exactly** (fidelity directive).

## Functional Requirements

### Must Have

- [ ] **History button** — a `View` linked to an `Input`, drawing the `▐↓▌` icon (U+2590 / U+2193
      narrow / U+258C) in the decoded `cpHistory` colors adjacent to the field. *(AR-135/138/139, PA-3/12)*
- [ ] **History open** — on button mouse-down, **Down while the linked `Input` is focused**, or
      **Alt+Down**; records the field's current text into the store, then pops the anchored popup.
      Aborts if the link refuses focus. *(AR-135, PA-6)*
- [ ] **History popup geometry** — window rect = field grown ±1 wide, height field-height + 7
      (8 rows for a 1-row field), `intersect`-clamped to the host (never flips up); hosts a
      `ListView` of the id's history, `wfClose`/no-zoom/no-number; overflow scrolls (owned ScrollBar);
      `maxRows` = max **visible** rows (default 6). *(AR-138, PA-4/PA-7)*
- [ ] **History pick / cancel** — Enter/double-click replaces the linked `Input` text (clamp
      `maxLength`) and `selectAll`s it **via the public Input linkage seam**; Esc or an outside
      mouse-down (consumed, no pass-through) cancels, leaving the field unchanged. *(AR-138/162/166, PA-8/15)*
- [ ] **History store** — a module-singleton `Map<historyId, string[]>`: `historyAdd` skips empty,
      dedups an existing equal entry, appends most-recent, evicts oldest when the per-id `maxEntries`
      cap (default 16) is full; `historyStr(id, index)` / `historyCount(id)` read the per-id list
      (bounds-checked); two `History` sharing an id share the list; list order **oldest→newest**.
      An injectable `history: Signal<string[]>` overrides the global store. *(AR-130, PA-2/PA-6)*
- [ ] **ComboBox** — composes an `Input` + drop-down `ListView<T>` in the shared popup; generic over
      `T` via `items: Signal<T[]>` + `getText` + **two signals** `value: Signal<T | null>` +
      composed `Input.text: Signal<string>`; opens on the AR-135 keys / a trailing `▐↓▌` button. *(AR-131/136/164, PA-11/14)*
- [ ] **ComboBox editable** (default) — free text into `text`; the dropdown filters-as-you-type
      (default case-insensitive substring, overridable); a pick sets `value` = item **and** `text` =
      `getText(item)`; free text matching nothing leaves `value` `null`. *(AR-131/134, PA-13)*
- [ ] **ComboBox select-only** (`editable:false`) — read-only picker showing `getText(value)`;
      typing drives type-ahead position-jump (RD-11 `ListView` `typeAhead`), not `text` editing;
      a pick sets `value`. *(AR-131/134)*
- [ ] **Shared anchored-popup primitive** — one internal implementation for both controls: mounts a
      `ListView` top-z in the overlay host, gives it focus, computes the clamped anchored placement,
      routes Enter/double-click → pick, Esc / outside mouse-down (consumed) / list-focus-loss →
      dismiss; **non-modal**. *(AR-132/137/166, PA-15)*
- [ ] **Theme roles** — five additive core History roles (button sides/arrow, window, viewer,
      viewer-focused), decoded bytes per [03-01](03-01-history.md). ComboBox reuses `input*`/`list*`
      + the button roles. *(AR-139, PA-12)*
- [ ] **Kitchen-sink stories + demo** — a `History` story and a `ComboBox` story (both modes, a
      visible bound-value echo), each passing the headless smoke test, plus a headless
      `demo:dropdowns` walkthrough (open → filter/type-ahead → pick → Esc-cancel). *(AR-140)*

### Should Have

- [ ] **History auto-hide** — hide the button when the store for its id is empty (nothing to drop),
      without diverging from the TV button visual when shown.
- [ ] **ComboBox `onSelect`/`command`** — emit on pick (reusing the RD-11 `ListView` seam) so a pick
      can drive an app command, not only the bound signal.

### Won't Have (Out of Scope)

- `Tree` (RD-15), `Table`/`DataGrid` (RD-16), `Tabs` (RD-17), `ProgressBar`/`Spinner` (RD-18),
  `Surface` (RD-19) — sibling RDs.
- **Multi-select** ComboBox / tag input — no TV counterpart; not the MVP dropdown surface.
- **Persisting** the History store across process runs — TV's is in-memory; an app/fs concern.
- **Outside-click pass-through** and **upward popup flip** — dismiss-only + clamp-only are faithful;
  both are possible later extensions. *(PA-15, decode note 3)*

## Technical Requirements

### Performance
- Popup mount/dismiss and filter/type-ahead reuse the RD-11 `ListView` virtual scroll (bounded
  visible window); no new per-frame cost beyond one popup subtree. No perf-budget change.

### Compatibility
- Pure TS, ESM/NodeNext (`.js` specifiers), **zero runtime deps** (`yarn check:deps` holds).
- Additive-only surface — no existing public API changes. Two additive intra-`ui` seams extend
  existing types (the `Input` linkage accessors; a `DispatchEvent` `getFocused()`/popup-host accessor,
  PF-002); the one edit to existing *behavior* (menu controller moving onto the imperative
  child-count derive, replacing its `:229/:247` toggles) is behavior-preserving (Phase 0 regression check).
- Files ≤ 500 lines; explicit named re-exports from `src/index.ts`.

### Security
- All draws route through RD-03 `DrawContext` → `ScreenBuffer` + core `sanitize`; `getText`/
  `historyStr` output is sanitized like any cell text (no raw escapes reach the terminal).
- The History store is bounded (per-id `maxEntries`, evict-oldest); reads are bounds-checked;
  field text stays gated by the `Input` validator/`maxLength`.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
| -------- | ------------------ | ------ | --------- | ------ |
| History store bound | byte-block (faithful) / per-id count cap | per-id count cap (default 16) | Non-visual internal; directive permits; preserves observable semantics | PA-2 |
| Down-arrow glyph | U+2193 / U+25BC / ASCII `v` | U+2193 ↓ narrow | Faithful CP437 `0x19`; project block-glyph convention | PA-3 |
| `maxRows` semantics | visible rows / fixed +7 / window rows | visible rows, default 6 | Intuitive + faithful default; window = maxRows+2 | PA-4 |
| Overlay visibility | derive-from-children / refcount | derive from children | No counter to desync; menu + dropdown coexist | PA-5 |
| History list order | most-recent-first / faithful | oldest→newest top→bottom | C++ oracle (`histlist.cpp`); corrects AC-2 | PA-6 |
| Input linkage seam | public fields / public methods | public methods, fields stay `protected` | Least churn, keeps encapsulation | PA-8 |
| ComboBox binding | one union signal / two signals | two signals (`value` + `text`) | Type-safe; resolves T-vs-string | PA-14 |

> **Traceability:** every decision above references the plan register (`00-ambiguity-register.md`);
> AR-130…AR-166 are inherited from the RD-14 feature register.

## Acceptance Criteria

The RD-14 AC-1…AC-14 are the immutable oracles (see [RD-14](../../requirements/RD-14-input-dropdowns.md)),
**with two fidelity corrections applied here** (the C++ outranks the RD):

- **AC-2 corrected** — the popup lists that id's history **oldest→newest, top→bottom** (not
  "most-recent first"); focuses item index 1 on open when count > 1. *(PA-6)*
- **AC-8 corrected** — the popup **window** is field-height + 7 (**8 rows** for a 1-row field); the
  visible **interior** list is window − 2 (**6 rows**); `maxRows` (default 6) caps visible rows. *(PA-4/PA-7)*

All other ACs (AC-1, AC-3…AC-7, AC-9…AC-14) hold as written in RD-14. They are enumerated as ST
cases in [07-testing-strategy.md](07-testing-strategy.md).
