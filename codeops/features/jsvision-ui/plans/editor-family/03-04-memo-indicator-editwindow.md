# Memo, Indicator, EditWindow (+ the `Window` seams)

> **Document**: 03-04-memo-indicator-editwindow.md
> **Parent**: [Index](00-index.md)
> **Files**: `packages/ui/src/editor/{memo.ts,indicator.ts,edit-window.ts}`; additive edits to
> `window/window.ts` + `desktop/desktop.ts` (PA-3/PA-19)

## Overview

The three composition components: the dialog-embeddable `Memo`, the `line:col` `Indicator`, and
the `EditWindow` blue-window chrome — plus the two additive reactive `Window` seams the family
needs (`dragging`, `active`).

## TV decode (GATE 1)

- **`Memo`** (`tmemo.cpp:27-98`, `editors.h:357-361`): `TEditor` minus files; palette
  `cpMemo "\x1A\x1B"` → `cpGrayDialog[26/27]=0x39/0x3A` → `cpAppColor` = **normal `0x30`
  (black-on-cyan), selected `0x2F` (white-on-green)** (`dialogs.h:80-82`, `app.h:146` — PA-8);
  `handleEvent` drops `kbTab` entirely (doesn't reach `TEditor`, so dialog Tab-nav works —
  `tmemo.cpp:69-73`); data = a `ushort`-length blob (`getData`/`setData`, `tmemo.cpp:38-61`) —
  modernized to the two-way `Signal<string>` (AR-263).
- **`Indicator`** (`tindictr.cpp:27-88`, `tvtext1.cpp:83-84`): palette `cpIndicator "\x02\x03"` →
  `cpBlueWindow[2/3]=0x09/0x0A` → **`0x1F` (white-on-blue) / `0x1A` (light-green-on-blue)**
  (PA-8). Draw (`tindictr.cpp:44-53`; marker `:56-57`, location `:60-63` — exec-GATE-1 anchors):
  NOT dragging → `getColor(1)` `0x1F` + `dragFrame` `\xCD` **═** U+2550; dragging (`sfDragging`) →
  `getColor(2)` `0x1A` + `normalFrame` `\xC4` **─** U+2500 (glyphs `tvtext1.cpp:83-84`);
  `modified` ⇒ `putChar(0, 15)` — CP437 `\x0F` = **☼ U+263C** at column 0; location `" line:col "`
  (both 1-based) right-aligned so the `:` sits at column 8 (`moveStr(8−…)` `:63`);
  `growMode = gfGrowLoY|gfGrowHiY` (sticks to the window bottom, `tindictr.cpp:34`).
- **`EditWindow`** (`teditwnd.cpp:29-95`, `tvtext2.cpp:153-154`): min **24×6** (`minEditWinSize`
  `:29`, `sizeLimits` `:91-95`); `ofTileable` (`:38`); explicit `new` at TV rects (end-exclusive,
  PF-006): hScrollBar `TRect(18, y−1, x−2, y)`, vScrollBar `TRect(x−1, 1, x, y−1)`, indicator
  `TRect(2, y−1, 16, y)` — **each `hide()`-den at creation** (`:40-59`); editor = the framed
  interior (`grow(−1,−1)`); title = `"Clipboard"` when `editor == clipboard`, else filename |
  `"Untitled"` (`getTitle`, `teditwnd.cpp:70-78`); **blue window** (`wpBlueWindow`, no palette
  override); `cmUpdateTitle` broadcast → `frame->drawView()` (`:80-89`) — ours is the reactive
  `Window.title` signal write (PF-013). TV always `new`s a `TFileEditor` *inside* `TEditWindow`
  (`:58`) — internal construction was already our extension point, so the plan-preflight PF-001
  caller-injection (`editor?: Editor`) is no less faithful.
- **Gadget visibility** (PA-10, `teditor2.cpp:541-560`): `TEditor::setState(sfActive)` toggles
  `sfVisible` on hScrollBar + vScrollBar + indicator — an inactive window shows a plain frame
  border; active shows all three. Propagates window → group → editor via
  `twindow.cpp:172-181`/`tgroup.cpp:521-539`.

## Implementation Details

### Additive `Window` seams (PA-3 / PA-19)

```ts
// window/window.ts — additive fields
readonly dragging: Signal<boolean>; // PA-3 — TV sfDragging made reactive
readonly active:   Signal<boolean>; // PA-19 — TV sfActive made reactive
```

`Desktop` writes them: `dragging.set(true)` in `beginMove`/`beginResize`/`beginResizeLeft`
(`desktop.ts:171-197`), `false` at BOTH clear sites (mouse-up `:220-224`, stale-capture abort
`:209-212`); `active` maintained on raise/focus-change/add/remove (the same places that decide
`drawFrame`'s active flag today — `drawFrame` reads the signal so frame + gadgets share one
source). Both default sensibly for manager-less windows (`active` true, `dragging` false) so
existing suites stay green (plan-local AC-1).

### `memo.ts` — `class Memo extends Editor`

```ts
export interface MemoOptions extends EditorOptions { value: Signal<string> }
```

Two-way bind with the ComboBox-idiom feedback guard (each direction reads only the other side;
AC-10 same-tick, no loop). Tab: **pass through** (return unhandled, the house Input precedent —
`input.ts:248` — semantically identical to TV's drop since the loop's built-in Tab then runs).
Roles `memoNormal`/`memoSelected`. No file surface, no 64 KB cap (AR-263).

### `indicator.ts` — `class Indicator extends View`

```ts
export class Indicator extends View {
  focusable = false;
  setValue(pos: { line: number; col: number }, modified: boolean): void; // the doUpdate push
}
```

Draw per the decode: fill `═` in `indicatorNormal`, or `─` in `indicatorDragging` while the
window's `dragging` signal is true (bound via the window ancestor, PA-3); `☼` at column 0 when
modified; `" line:col "` 1-based, right-aligned, colon at column 8 (AC-11). Values are plain
signals so `setValue` coalesces repaints.

### `edit-window.ts` — `class EditWindow extends Window`

```ts
export interface EditWindowOptions {
  editor?: Editor;                   // PF-001 — caller-supplied editor (e.g. a files FileEditor,
                                     // or the shared clipboard editor); absent ⇒ a bare Editor
  clipboard?: Editor; editorDialog?: EditorDialogHandler;
}
```

**Precedence (PF-001):** a supplied `editor` wins — `clipboard`/`editorDialog` then apply only to
the identity/title check and are NOT re-wired into it (they configure the **default-constructed**
`Editor` when `editor` is absent). No `fs`/`fileName` options: ui stays fs-free — file hosting is
the files-side `openFileInEditor` factory (03-06), which binds `fileName → Window.title`.

Composes at the decoded rects (absolute layout, end-exclusive → width/height per PF-006/AC-12);
`minWidth/minHeight = 24/6`; tileable. Gadget `visible` bound to `this.active` (PA-10/PA-19);
`attachGadgets` wires the editor's sync pushes (03-02). Title: reactive — `'Clipboard'` when the
hosted `editor === options.clipboard` (the TV identity check, `teditwnd.cpp:70-78`), else
`'Untitled'`; the files factory (or `FileEditor.saveAs`) writes the title signal (PF-013).

## Integration Points

`Editor` (03-02) drives `Indicator.setValue` + bar `setRange` from its update tick; `FileEditor`
(03-06) slots in as the caller-supplied `editor` via the files-side `openFileInEditor` factory
(PF-001); `Dialog` hosts `Memo` (Tab-nav proven by AC-10); the tvedit clone (03-07) opens
`EditWindow`s on the `Desktop`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Indicator without a `Window` ancestor | Renders resting state (no drag bind); no throw | PA-3 edge |
| EditWindow below 24×6 | `sizeLimits` clamp (decode) | AC-12 |
| Memo signal written externally mid-edit | Feedback-guarded two-way bind (no loop) | AC-10 / AR-263 |
| Manager-less window | `active` defaults true — gadgets visible standalone | PA-19 / plan AC-1 |

## Testing Requirements

- Spec: ST-22…ST-27 (`memo.spec`, `indicator.spec`, `edit-window.spec`, `window-seams` cases).
- Impl: drag-signal set/clear at all 5 sites, growMode reflow on resize, title switching,
  gadget re-show on re-activate.
