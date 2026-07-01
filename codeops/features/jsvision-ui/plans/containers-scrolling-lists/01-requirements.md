# 01 — Requirements & Scope (RD-11)

> **Source**: [RD-11](../../requirements/RD-11-containers-scrolling-lists.md) · **Implements**: jsvision-ui/RD-11
> **CodeOps Skills Version**: 3.1.0

## In scope

The container/scrolling/list tier + the rich Dialog, each faithfully transcribed from Turbo Vision:

1. **`ScrollBar`** (TV `TScrollBar`) — vertical/horizontal bar: arrows + `▒` track + `■` thumb; two-way
   `value: Signal<number>` within `{ min, max, pageStep, arrowStep }`; arrow/page/thumb/wheel gestures.
   *(AR-111, PA-14)*
2. **`Scroller`** (TV `TScroller`) — a viewport `Group` clipping oversized content, offsetting it by a
   scroll delta; auto-creates & owns its scrollbar(s). *(AR-105, PA-8)*
3. **`ListView<T>` / `ListBox`** (TV `TListViewer`/`TListBox`/`TSortedListBox`) — single-column virtual
   scroll (renders only visible rows via `getText`); `items`/`focused`/`selected` signals; optional
   `sorted` + `typeAhead`; `ListBox` = the `string` preset; auto-owned `ScrollBar`. *(AR-104/106, PA-2/3/5/15)*
4. **`Dialog`** (TV `TDialog`) — a `Window`-derived modal (`execView`) + modeless (`desktop.add`)
   container hosting RD-06 controls; terminating-command result; a positive-close `valid()` sweep
   (DEF-16); standard-button helpers `ok`/`cancel`/`yes`/`no`. *(AR-107/108/109, PA-1/6/7/13)*
5. **Additive theme roles** `scrollBarPage`/`scrollBarControls` + `listNormal`/`listFocused`/
   `listSelected`/`listDivider` on core `Theme` + `defaultTheme`; `Commands` `ok`/`cancel`/`yes`/`no`.
   *(AR-112, PA-10/12)*
6. **Kitchen-sink** — a story per new visual component + the navigator upgraded to a `ListView`-in-
   `Scroller` sidebar + a headless `demo:containers`. *(AR-110/114, PA-11)*

## Out of scope (deferred — see RD-11 §Won't-Have)

- Multi-column `ListViewer` (`numCols`) / `Table`/`DataGrid` → **RD-07** (AR-104).
- `ComboBox` (Input + ListView dropdown) → **RD-07**.
- File-bound dialogs → RD-09; `ColorDialog`/Help → Tier-3.
- A `View`→host **hardware caret** (the list/input cursor) → tracked in [[DEF-19]] (RD-07 host pass); RD-11
  shows focus by colour only (PA-5).

## Acceptance criteria → spec-test mapping

The 15 RD-11 ACs (AC-1…AC-15) are the immutable oracles. They map to spec tests ST-01…ST-16 in
[07-testing-strategy.md](07-testing-strategy.md); the TV `.cpp`/`.h` is the drawing oracle (glyphs,
thumb math, row layout, frame, resolved colours), and per the fidelity directive the C++ source
**outranks a spec oracle** if they disagree (fix the oracle against the source, cite the `.cpp`).

| AC | Summary | ST |
|----|---------|----|
| AC-1 | ScrollBar draw + arrow/page step + clamp | ST-01, ST-02 |
| AC-2 | Scroller clip + reveal + bar tracks delta | ST-03 |
| AC-3 | Scroller auto-owns bars (`vertical`/`both`/`none`) | ST-04 |
| AC-4 | ListView virtual scroll (only visible rows) + focus/page + bar | ST-05 |
| AC-5 | ListView select + emit + click focus/select | ST-06 |
| AC-6 | sorted + type-ahead (off by default) | ST-07 |
| AC-7 | ListBox string preset | ST-08 |
| AC-8 | Dialog modal result = terminating command; data in bound signals | ST-09 |
| AC-9 | Dialog `valid()` gate vetoes OK on invalid; Cancel/Esc bypass (DEF-16) | ST-10 |
| AC-10 | Dialog modeless via `desktop.add` | ST-11 |
| AC-11 | Standard-button helpers emit `ok`/`cancel`/`yes`/`no` | ST-12 |
| AC-12 | Theme roles present + `encode()` non-throwing | ST-13 |
| AC-13 | Faithful geometry (glyphs, thumb, rows, frame, colours) | ST-14 |
| AC-14 | Packaging: `src/{scroll,list,dialog}/`, explicit re-exports, `check:deps`, ≤500 lines | ST-15 |
| AC-15 | Navigator sidebar + per-component stories + `demo:containers` | ST-16 |

## Definition of done

`yarn verify` (typecheck + build + all unit tests) + `yarn test:e2e` + `yarn check:deps` + `yarn lint`
all green; ST-01…ST-16 pass; each TV-derived component's GATE-2 AFTER-diff recorded in code/commit; the
kitchen-sink smoke test passes for every new story; `demo:containers` runs headless.
