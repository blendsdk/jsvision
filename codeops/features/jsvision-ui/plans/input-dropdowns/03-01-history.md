# History + Store: Input Dropdowns

> **Document**: 03-01-history.md
> **Parent**: [Index](00-index.md)

## Overview

`History` is a faithful re-creation of Turbo Vision's `THistory`: a `▐↓▌` button linked to an
`Input`, dropping down a bounded MRU list of that field's past values. This document carries the
**TV GATE-1 decode** (the fidelity oracle for the button, popup geometry, colors, and pick/cancel
behavior — every fact cited to `magiblot/tvision` `file:line`) plus the modernized store design.

---

## TV decode (GATE 1) — `THistory` / `THistoryWindow` / `THistoryViewer` / `histlist.cpp`

> Nibble convention: attribute byte `0xHL`, high nibble `H` = background, low nibble `L` =
> foreground (CGA: 0 black · 1 blue · 2 green · 7 lightGray · A lightGreen · F white). All concrete
> `0xHL` values assume a **gray `TDialog`** owner (this project's default); a blue/cyan dialog owner
> re-resolves the same chain through `cpBlueDialog`/`cpCyanDialog` (local palettes + `~`-marker
> layout are invariant — only the final `cpAppColor` byte shifts). Color chain:
> `getColor(0xHHLL)` → low byte uses local-palette index `LL`, high byte index `HH`
> (`tview.cpp:484-494`); `mapColor` recurses view→owner→app to `cpAppColor` (`mapcolor.cpp:20-38`).

### 1. Button draw + sizing (`thistory.cpp:56-62`, `tvtext1.cpp:86`)

- Draw: `b.moveCStr(0, icon, getColor(0x0102)); writeLine(0, 0, size.x, size.y, b);`
- Icon `THistory::icon = "\xDE~\x19~\xDD"` — byte-by-byte:

  | CP437 | Glyph | Unicode | Note |
  |-------|-------|---------|------|
  | `0xDE` | ▐ | **U+2590** RIGHT HALF BLOCK | render narrow (project block-glyph convention) |
  | `~` | — | (color-toggle marker, not printed) | toggles low↔high byte |
  | `0x19` | ↓ | **U+2193** DOWNWARDS ARROW | render narrow (PA-3); **not** ▼/U+25BC |
  | `~` | — | (color-toggle marker, not printed) | toggles back |
  | `0xDD` | ▌ | **U+258C** LEFT HALF BLOCK | render narrow |

  Rendered visible string = **3 cells: `▐↓▌`**. `moveCStr` starts on the **low** byte; each `~`
  toggles (`drivers.cpp:155-157`): `▐` = low (idx 2 "Sides"), `↓` = high (idx 1 "Arrow"), `▌` = low
  (idx 2 "Sides"). Palette layout `1=Arrow, 2=Sides` (`dialogs.h:999-1002`).
- Local palette `cpHistory = "\x16\x17"` (`thistory.cpp:37`): idx 1 = `0x16`, idx 2 = `0x17`.
- **Resolved bytes (gray-dialog owner):**
  - **Arrow (↓)** — `0x16` → `cpGrayDialog[22]=0x35` → `cpAppColor[53]=`**`0x20`** = **black-on-green**.
  - **Sides (▐ ▌)** — `0x17` → `cpGrayDialog[23]=0x36` → `cpAppColor[54]=`**`0x72`** = **green-on-lightGray**.
- **Sizing:** the button bounds are **caller-supplied** (`THistory` extends `TView(bounds)`,
  `:39-48`); the icon is exactly **3×1**, conventionally placed flush-right sharing the field's top
  row. `ofPostProcess` + `evBroadcast` set in the ctor (`:46-47`).

### 2. Open triggers (`thistory.cpp:77-89`)

Opens on: **any `evMouseDown`** on the button (`:77`), **or** `evKeyDown` with
`ctrlToArrow(keyCode) == kbDown` **while the link is focused** (`(link->state & sfFocused) != 0`,
`:78-80`). Guard: `if (!link->focus()) { clearEvent; return; }` (`:84-88`); then
`recordHistory(link->data)` records the current field text **before** opening (`:89`).
`evBroadcast` `cmReleasedFocus`(own link)/`cmRecordHistory` also record (no open) (`:114-122`).
**Modern extension (AR-135):** also open on **Alt+Down**.

### 3. Popup geometry (`thistory.cpp:90-98`) — **PF-007/PA-4/PA-7**

From the linked field bounds `a=(x₀,y₀) b=(x₁,y₀+1)`:
```
r.a.x--;  r.b.x++;  r.b.y += 7;  r.a.y--;
r.intersect(owner->getExtent());   // clamp to the dialog; truncate near edges, never flip up
r.b.y--;
```
Result (1-row field, unclamped): `a=(x₀-1, y₀-1)`, `b=(x₁+1, y₀+7)` →
**width = fieldWidth + 2**, **height = fieldHeight + 7 = 8 rows**, top starts 1 row above the field.
Frame + `initViewer`'s `r.grow(-1,-1)` (`thistwin.cpp:63`) inset the interior to **rows 1..7 → 6
visible list rows** (`visibleRows = windowHeight − 2`). **`maxRows` (default 6) caps the visible
rows; window height = `maxRows + 2`.**

### 4. Popup framing + colors (`thistwin.cpp:26-38`, `thstview.cpp:33`)

- `TWindow(bounds, 0, wnNoNumber)`, `flags = wfClose` — **close box only**, no move/grow/zoom, no
  number, no title. Inserted via `owner->execView(historyWindow)` (owner = the gray dialog).
- Window palette `cpHistoryWindow = "\x13\x13\x15\x18\x17\x13\x14"` (`thistwin.cpp:26`); frame uses
  `cpFrame` (`tframe.cpp:27,41-61`). **Resolved bytes:**
  - **Frame border** (active low byte) → `0x13` → `cpGrayDialog[19]=0x32` → `cpAppColor[50]=`**`0x1F`** = **white-on-blue**.
  - **Frame icon / accent** (active high byte) → `0x15` → `cpGrayDialog[21]=0x34` → `cpAppColor[52]=`**`0x1A`** = **lightGreen-on-blue**.
  - So the popup is a **blue window even from a gray dialog**.
- Viewer palette `cpHistoryViewer = "\x06\x06\x07\x06\x06"` (`thstview.cpp:33`); `TListViewer::draw`
  uses idx 1/2 (normal), 3 (focused), 4 (selected), 5 (divider) (`tlstview.cpp:88-96,148,150`):
  - **Normal / unfocused / selected-unfocused / divider** (`0x06`) → `cpHistoryWindow[6]=0x13` → **`0x1F`** = **white-on-blue**.
  - **Focused item** (`0x07`) → `cpHistoryWindow[7]=0x14` → `cpGrayDialog[20]=0x33` → `cpAppColor[51]=`**`0x2F`** = **white-on-green**.
  - Single column (`numCols=1`), **no markers** (no `[ ]`), divider char at `size.x` (off the right
    edge → not visibly drawn). Empty list shows `emptyText` via `getColor(1)`.

### 5. Pick / cancel (`thstview.cpp:66-82`, `thistwin.cpp:46-59`, `thistory.cpp:101-110`)

- **Pick** — `(evMouseDown && meDoubleClick) || (evKeyDown && keyCode==kbEnter)` → `endModal(cmOK)`.
  On `cmOK`: `getSelection(rslt)` = the **focused** viewer item text
  (`historyStr(historyId, focused)`); `strnzcpy(link->data, rslt, link->maxLen+1)` (truncate to
  field capacity); `link->selectAll(True)`; `link->drawView()`; `destroy(historyWindow)`.
- **Cancel** — Esc / `cmCancel` (`thstview.cpp:76-82`) or **outside mouse-down**
  (`!mouseInView` → `endModal(cmCancel)`, `thistwin.cpp:51-59`); close box → `cmClose` → modal turns
  it into `cmCancel` (`twindow.cpp:117-132`). Field unchanged.

### 6. Store semantics (`histlist.cpp`) — **PF-008/PA-2/PA-6**

- TV stores `HistRec{uchar id; uchar len; char str[1];}` packed in one flat **1024-byte** block
  (`historySize`, `:95`), shared across **all** ids; eviction drops the **front-most (oldest)**
  record by bytes until the incoming record fits (`insertString`, `:123-140`).
- `historyAdd(id, str)` (`:161-173`): **skip empty** (`:163`), **dedup** (remove an existing equal
  entry, `:167-172`), **append at tail** (most-recent).
- **Order:** `historyStr(id, 0)` = front-most = **oldest** (`:176-185`; `startId` → `curRec =
  historyBlock`, advance once); highest index = newest (tail). Viewer draws index 0 at top →
  **oldest→newest, top→bottom**; focuses item index 1 on open when count > 1 (`thstview.cpp:42-45`).
  → **This is the AC-2 correction (PA-6).**

> **GATE-2 (AFTER):** re-open `thistory.cpp`/`thistwin.cpp`/`thstview.cpp`/`histlist.cpp` and diff
> the rendered button, popup rect, frame, and list rows cell-by-cell + re-confirm the **list order
> (oldest-at-top)** and the resolved bytes above. Record the diff in the code/commit.

---

## Architecture

### Proposed Changes

Two new files (`dropdown/history.ts`, `dropdown/history-store.ts`) plus reuse of
`dropdown/popup.ts` ([03-02](03-02-anchored-popup.md)) and the public Input seam
([03-04](03-04-seams-and-theme.md)). No engine changes.

## Implementation Details

### New Types/Interfaces

```ts
/** Options for a History control. */
export interface HistoryOptions {
  /** The Input this history is linked to (drawn adjacent; its text is read/replaced). */
  link: Input;
  /** Numeric id keying the shared global MRU store; two Histories with the same id share a list. */
  historyId?: number;
  /** Escape hatch (AR-130): bind an app-owned list instead of the global store. */
  history?: Signal<string[]>;
  /** Max visible list rows in the popup (default 6; window height = maxRows + 2). PA-4. */
  maxRows?: number;
}
```

### New Functions/Methods

```ts
/** The History button: draws `▐↓▌`, opens the anchored popup on the AR-135 triggers. */
export class History extends View { /* draw(): the 3-cell icon in cpHistory colors; onEvent(): open */ }

// ── history-store.ts — modernized per-id entry-count MRU (PA-2/PA-6) ──
/** Default per-id cap (PA-2). */
export const HISTORY_MAX_ENTRIES = 16;
/** Append `str` as most-recent for `id`: skip empty, dedup, evict-oldest past the cap. */
export function historyAdd(id: number, str: string, maxEntries?: number): void;
/** The `index`-th entry for `id` (0 = oldest), or undefined if out of range (bounds-checked). */
export function historyStr(id: number, index: number): string | undefined;
/** Count of entries for `id`. */
export function historyCount(id: number): number;
/** Test-only: clear all stored history. */
export function clearHistory(): void;
```

The store is a module-singleton `Map<number, string[]>`, arrays ordered **oldest→newest** (PA-6);
`historyAdd` filters empty, removes any equal entry, pushes to the end, and `shift()`s the front
while `length > maxEntries`. When `HistoryOptions.history` is supplied, `History` reads/writes that
signal's array (same ordering + semantics) instead of the store.

### Integration Points

- Draws the icon via the additive `historyButtonSides`/`historyButtonArrow` roles ([03-04](03-04-seams-and-theme.md)).
- Opens the shared popup ([03-02](03-02-anchored-popup.md)) anchored to `link`'s bounds, hosting a
  `ListView<string>` over the id's entries.
- On pick: writes the picked string (clamped to `link.getMaxLength()`) into `link.getValueSignal()`,
  then `link.selectAll()` (the public seam, PA-8).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Open with an empty store for the id | Popup shows empty (no rows) or button auto-hides (Should-Have); never throws | AR-130 |
| `historyStr` index out of range | Returns `undefined` (bounds-checked), never throws | PA-2, security |
| Link refuses focus on open | Abort open (mirror `!link->focus()` guard); no popup | decode §2 |
| Pick longer than `maxLength` | `str.slice(0, maxLength)` before writing the signal (clamp) | decode §5 |
| Empty / whitespace add | `historyAdd` skips empty (faithful) | AR-130 |

## Testing Requirements

- Button icon draws `▐↓▌` in the decoded colors (buffer pre-`serialize`); popup rect = field±1 wide
  × ≤8 rows clamped; pick replaces + `selectAll`s via the seam; cancel leaves the field unchanged.
- Store: skip-empty, dedup, append-most-recent, evict-oldest at the cap, oldest-at-top order, shared
  list per id, injectable-signal override, bounds-checked reads. (See ST-cases in
  [07-testing-strategy.md](07-testing-strategy.md).)
