# Testing Strategy: Input Dropdowns

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Spec-first per the CodeOps ordering (spec RED → implement GREEN → impl tests). Expectations below
derive **only** from RD-14 (AC-1…AC-14, with the PA-6/PA-7 fidelity corrections), the TV GATE-1
decode ([03-01](03-01-history.md)), and the plan register — never from implementation. For
TV-derived facts the **C++ source is the oracle** (a spec oracle that disagrees with a faithful
decode is the defect — fix the oracle against the source, citing `file:line`).

Headless throughout (buffer assertions pre-`serialize`, synthetic dispatch) — matches the RD-11
`containers` test style; no TTY.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

### History button + open (`history.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-1 | A `History` linked to an `Input`, drawn | Buffer shows `▐↓▌` (U+2590, **U+2193**, U+258C) at the button cells; sides = `historyButtonSides` (green-on-lightGray), arrow = `historyButtonArrow` (black-on-green) | AC-1, decode §1, PA-3/PA-12 |
| ST-2 | Click the button | Anchored popup opens listing the id's history; window rect = field grown ±1 wide, height = field+7 (**8 rows** for 1-row field, fixed — entry count never sizes it), clamped to host | AC-2 (open) / **AC-8** (geometry), decode §3, PA-4/PA-7 |
| ST-3 | **Down** while the linked `Input` is focused | Popup opens | AC-2, decode §2 |
| ST-4 | **Down** while the `Input` is **not** focused | Popup does **not** open | decode §2 |
| ST-5 | **Alt+Down** (linked or focused) | Popup opens (modern extension) | AC-2, AR-135 |
| ST-6 | Open records current field text first | The field's current text is added to the store before the list is shown | decode §2 |
| ST-7 | Popup list order | Entries listed **oldest→newest, top→bottom** (index 0 = oldest at top); focus on item index 1 when count > 1 | **AC-2 corrected**, PA-6, decode §6 |

### History pick / cancel (`history.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-8 | Enter/double-click a row | Linked `Input` text replaced with the row (clamped to `getMaxLength()`) **and** `selectAll()`ed, via the public seam | AC-4, decode §5, PA-8 |
| ST-9 | Pick a row longer than `maxLength` | Written value is `row.slice(0, maxLength)` | decode §5 |
| ST-10 | Esc | Popup dismissed, field **unchanged** | AC-4, decode §5 |
| ST-11 | Outside mouse-down | Popup dismissed, click **consumed** (not passed to the control behind), field unchanged | AC-4/AC-9, PA-15 |

### History store (`history-store.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-12 | `historyAdd(id, '')` | No-op (skip empty) | AC-3, decode §6 |
| ST-13 | `historyAdd(id, 'a'); historyAdd(id, 'b'); historyAdd(id, 'a')` | `['b','a']` — dedup removes the earlier `'a'`, re-appends most-recent | AC-3, decode §6 |
| ST-14 | Add > `maxEntries` (16) entries | Length capped at 16; the **oldest** (front) evicted first | AC-3, PA-2 |
| ST-15 | `historyStr(id, 0)` after adds | Returns the **oldest** entry (index 0 = front); `historyStr(id, out-of-range)` → `undefined` | AC-3, PA-2/PA-6 |
| ST-16 | Two `History` with the same `historyId` | Share the same list | AC-3, decode §6 |
| ST-17 | `History` given `history: Signal<string[]>` | Uses that signal, not the global store | AC-3, AR-130 |

### Anchored popup primitive (`popup.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-18 | Open a popup | The hosted `ListView` receives focus; overlay becomes visible (derived) | AC-9, PA-5/PA-15 |
| ST-19 | Anchor near the bottom edge | Popup rect `intersect`-clamped (fewer visible rows); **does not flip upward** | AC-8, PA-15 |
| ST-20 | Entries exceed `maxRows` | List scrolls via its owned RD-11 ScrollBar; ≤ `maxRows` (default 6) visible | AC-8, PA-4 |
| ST-21 | List loses focus (Tab-away) | Popup dismissed via the `focusSignal()` (PF-009) path | AC-9, PA-15 |
| ST-22 | Esc + outside-down fire together (race) | `dismiss()` runs once (idempotent) | PA-15 |
| ST-23 | Popup open, a background signal changes | Background repaints (non-modal); after a dismissing click the UI is interactable | AC-9, AR-132 |

### ComboBox (`combobox.spec.test.ts`)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-24 | Editable: type `'gr'` over items `['Red','Green','Blue']` | Dropdown narrows to `['Green']` (case-insensitive substring); `text` = `'gr'` | AC-5, PA-13 |
| ST-25 | Editable: pick `'Green'` | `value` = `'Green'` **and** `text` = `'Green'` | AC-5, PA-14 |
| ST-26 | Editable: free text `'xyz'` matching nothing | `value` = `null`; `text` = `'xyz'` | AC-5, PA-14 |
| ST-27 | Select-only (`editable:false`): render with `value='Blue'` | Field shows `getText('Blue')`, read-only | AC-6, AR-131 |
| ST-28 | Select-only: type `'b'` | `focused` jumps to the first row matching (type-ahead); `text` **not** edited | AC-6, AR-104 |
| ST-29 | Select-only: pick a row | `value` set to that item | AC-6 |
| ST-30 | Bound to `items` + `getText` | Rows show `getText(item)`; updating `items` re-renders visible rows; `value` reflects selection independent of `text` | AC-7, PA-14 |
| ST-31 | Open via trailing `▐↓▌` button / Alt+Down / Down | Popup opens (same geometry as History) | **AC-2/AR-135** (open keys), AC-8 (geometry), PA-11 |

### Theme + packaging + security (`dropdown.packaging.spec.test.ts`, theme in core)

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|------------------|----------------------------|--------|
| ST-32 | `defaultTheme` History roles | `historyButtonSides`/`historyButtonArrow`/`historyWindow`(+border/icon)/`historyViewer`/`historyViewerFocused` present with the decoded bytes; each `encode()`s without throwing; only new core role symbols | AC-10, PA-12 |
| ST-33 | Button icon + popup rect + rows vs. TV | Match `thistory.cpp`/`thstview.cpp` (buffer pre-`serialize`): 3-cell icon, ±1 grown rect, single-column no-marker rows, focused row white-on-green | AC-11, decode |
| ST-34 | Packaging | `dropdown/` files exist with explicit named re-exports from `src/index.ts`; `yarn check:deps` passes (zero runtime deps); files ≤ 500 lines | AC-12, PA-10 |
| ST-35 | Security | Item/history text sanitized to screen (no raw escapes); store bounded + bounds-checked reads; field text gated by the `Input` validator/`maxLength` | AC-14, security |
| ST-36 | Stories + demo | `History` + `ComboBox` stories pass the headless smoke test; `demo:dropdowns` runs headless (open → filter/type-ahead → pick → Esc-cancel) | AC-13, AR-140 |

## Test Categories

### Specification Tests (from ST-cases above) — written BEFORE implementation

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/ui/test/dropdown.seams.spec.test.ts` | Phase-0 seams | Input linkage seam · imperative derived overlay visibility · popup-host `DispatchEvent` envelope seam (PF-002) |
| `packages/ui/test/history.spec.test.ts` | ST-1…ST-11 | History control |
| `packages/ui/test/history-store.spec.test.ts` | ST-12…ST-17 | History store |
| `packages/ui/test/popup.spec.test.ts` | ST-18…ST-23 | Anchored popup |
| `packages/ui/test/combobox.spec.test.ts` | ST-24…ST-31 | ComboBox |
| `packages/ui/test/dropdown.packaging.spec.test.ts` | ST-34, ST-35 | Packaging/security |
| `packages/core/test/history-theme.spec.test.ts` | ST-32 | Core theme roles |
| `packages/ui/test/fidelity.dropdown.spec.test.ts` | ST-33 | TV fidelity (buffer diff) |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (extend) | ST-36 | Stories smoke |

### Implementation Tests (edge cases, internals) — written AFTER implementation

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `history.impl.test.ts` | Open-guard (link refuses focus), auto-hide when empty, `evBroadcast` record, `Infinity` maxLength clamp | High |
| `history-store.impl.test.ts` | Whitespace add, cap boundary (exactly 16 → 17), injectable-signal ordering, `clearHistory` | High |
| `popup.impl.test.ts` | Double-dismiss idempotence, focus save/restore, mount/unmount overlay derive, ScrollBar wiring | High |
| `combobox.impl.test.ts` | Custom `filter` predicate, `onSelect`/`command` emit, `items` change while open, empty filtered list | Med |
| `dropdown.packaging.impl.test.ts` | Re-export surface, file line-count guard | Low |

### Integration / E2E

| Test | Components | Description |
| ---- | ---------- | ----------- |
| `dropdowns-demo.e2e.test.ts` | History + ComboBox + shell | `demo:dropdowns` headless walkthrough (ASCII frame per step) |
| menu-coexistence (in `popup.impl`) | menu + dropdown overlay | F10 menu open while a combo popup is open — both visible, neither stomps (PA-5) |

## Test Data / Fixtures
- Item lists (`['Red','Green','Blue']`), a seeded history list, an `Input` with a small `maxLength`
  for clamp tests. Real objects throughout (no mocks — headless views + synthetic dispatch).

## Verification Checklist
- [ ] All ST-1…ST-36 defined with concrete input/output pairs
- [ ] Every ST traces to an AC / decode `file:line` / AR
- [ ] Spec tests written + verified FAIL (red) before implementation
- [ ] All spec tests pass after implementation (green); fidelity oracles diffed against C++ (GATE-2)
- [ ] Impl tests written for edge cases; full `yarn verify` + `yarn check:deps` green; no regressions
      (esp. `app-shell.menu.*` after the PA-5 migration)
