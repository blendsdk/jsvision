# 02 — Current State (seams + TV decode)

> **CodeOps Skills Version**: 3.1.0 · verified against live source 2026-07-01.

Two recon passes ground this plan: (A) the `@jsvision/ui` seams RD-11 builds on, and (B) the TV C++
GATE-1 decode. **RD-11 is almost entirely additive** — the only edits to existing code are the
additive theme roles, `Commands`, the `execView` modal-host injection, `src/index.ts` re-exports, the
kitchen-sink shell, **plus two small frame-chrome edits** (`window/frame.ts` made dialog-aware + an
`icon` on the core `dialog` role) that the `Dialog` needs (PF-001). No subsystem is reshaped.

## A. UI seams (all additive)

### Reuse as-is (no edits)
- **`Window`** (`packages/ui/src/window/window.ts:43`) — `extends Group`; reactive `title: Signal<string>`;
  `movable`/`resizable`/`zoomable`/`closable`; `layout = { position:'absolute', padding:1 }`; `draw()`
  (`:114`) picks role `active?'window':'windowInactive'` then calls `drawFrame(...)`; `WindowManager`
  back-ref via `attachManager()` (`:73`). **`Dialog` subclasses this** (PA-6), but the frame chrome is
  **not** drop-in — `drawFrame`'s `role` is typed `FrameRole = 'window' | 'windowInactive'` (`frame.ts:53`),
  it reads `theme.icon` (`:118`) which the `dialog` role lacks, and it always draws the zoom `[↑]` box
  (`:145-152`, no `zoomable` gate). So `frame.ts` is **generalized** to be dialog-aware (see the additive
  edits below + PF-001) and `Dialog` overrides `onEvent` for the close/Esc path (PF-002).
- **`Desktop`** (`packages/ui/src/desktop/desktop.ts:43`) — `add`/`addWindow(w)` (`:96`, injects the WM +
  raises), `windows()`, `raise` (`:115`), `removeWindow`. Modeless dialogs use `add`/`addWindow` (PA-6).
- **`EventLoop`** (`packages/ui/src/event/event-loop.ts`) — `execView<R>(view): Promise<R>` (`:127`,
  resolves to whatever `endModal(result)` passes ⇒ the Dialog resolves to its terminating command),
  `endModal<R>(result)` (`:136`), `setCapture`/`releaseCapture` (`:170`, the ScrollBar thumb-drag seam),
  `emitCommand` (`:113`), `isCommandEnabled` (`:117`), `focusView`, `onFrame`, the single `runTick` (`:150`).
- **`modal.ts`** (`:59`) — `begin`/`end` LIFO stack, save/restore focus around a modal. `execView` will be
  extended (PA-1) to inject the modal-host seam here.
- **View/Group/DrawContext** (`packages/ui/src/view/`) — `View` (`view.ts:34`: `bounds`, `focusable`,
  `onEvent`, `bind`, `invalidate`/`invalidateLayout`, `onMount`, `focusSignal()` PF-009); `Group`
  (`group.ts:22`: `children`, `background`, `add`/`remove`, `current`); `DrawContext`
  (`draw-context.ts:40`: `text`/`fillRect`/`fill`/`box`/`color(role)`/`role(name)`, auto-clipped to the
  view rect — this clipping is how `Scroller` reveals only the visible content window, PA-8).
- **RD-06 controls** — `Button` (`controls/button.ts:35`: `command`/`onClick`/`default`/`disabled`;
  `activate()` (`:202`) does `ev.emit?.(command)`) — the standard-button helpers are `Button` presets;
  `Input` (`controls/input.ts`) exposes **`valid(): boolean`** (`:87`, runs the blocking validator, sets
  `invalid`) — the Dialog `valid()`-sweep calls each child's `valid()`; `Validator`
  (`validators/types.ts:9`: `isValidInput`/`isValid`).

### Additive edits (the only changes to existing code)
- **`Commands`** (`packages/ui/src/status/commands.ts:12`) — append `ok`/`cancel`/`yes`/`no` (PA-12).
- **`Theme` + `defaultTheme`** (`packages/core/src/engine/color/theme.ts`, `ThemeRole = {fg,bg,hotkey?}`,
  `PALETTE` DOS-16 names) — append `scrollBarPage`/`scrollBarControls` + `listNormal`/`listFocused`/
  `listSelected`/`listDivider` (PA-10). `ThemeRoleName = keyof Theme` picks them up automatically.
  **Also add an `icon` field to the existing `dialog` role** (`theme.ts:43` currently `border`+`title`
  only) so the generalized `drawFrame` can paint the dialog's close box (PF-001).
- **`window/frame.ts`** (PF-001) — make the shared frame drawer dialog-aware: widen `FrameRole` to
  include `'dialog'`; add `closable`/`zoomable` to `FrameState` and **gate** the close/zoom icon draws on
  them (TV `TFrame` gates each on `wfClose`/`wfZoom`). Keeps one fidelity-verified frame drawer (DRY).
- **`EventLoop.execView`** — inject `attachModalHost({ endModal, isCommandEnabled })` into the modal view
  if present (PA-1) — one additive intra-package seam (precedent: `setCapture`/`onFrame`, AR-82/84).
- **`packages/ui/src/index.ts`** — explicit named re-exports for the new `scroll/`, `list/`, `dialog/`
  barrels (the AR-102 pattern; the file already blocks re-exports per subsystem).
- **Kitchen-sink** `shell.ts` (navigator, PA-11) + `stories/index.ts` (one line per story).

> **Note (PF-001):** the `frame.ts` + `dialog`-role-`icon` edits are the two edits to existing code
> beyond the additive-role/`Commands`/`execView` set — the earlier "no existing subsystem needs
> reshaping" wording is corrected here and in `99` Notes. They are small and localized to the frame
> chrome; the alternative (a bespoke Dialog frame drawer) was rejected as a DRY/fidelity duplication.

> ⚠️ The UI recon proposed placeholder colours for the new theme roles — **ignored**; the byte-accurate
> values come from the TV decode below (guessing TV colours is the exact failure the fidelity gate exists
> to prevent — cf. the RD-06 button-shadow mis-decode).

## B. TV decode summary (GATE-1 — full per-component detail in the 03-* specs)

The getColor chain (`tview.cpp:484` + `mapcolor.cpp:20`): 1-indexed view-local palette → owner
(`mapColor` recurses) → `cpAppColor` `0xHL` (H=bg nibble, L=fg nibble). `cpGrayDialog` (`dialogs.h:80`)
is an identity+offset map: dialog slot `N` → `cpAppColor[31+N]`.

- **`TScrollBar`** (`tscrlbar.cpp`) — glyphs `tvtext1.cpp:113`: vertical `{▲0x1E, ▼0x1F, ▒0xB1, ■0xFE,
  ▓0xB2}`, horizontal `{◄0x11, ►0x10, ▒, ■, ▓}`. `drawPos` (`:65`, from `draw()` `:60`): `[arrow@0 | track 1..s-1 | arrow@s]`,
  `s=getSize()-1`, thumb `■` overwrites track at `pos`. `getPos` (`:89`):
  `pos = ((value-min)*(getSize()-3) + r/2)/r + 1`, `pos∈[1, getSize()-2]`, `getSize()=max(3,len)`.
  `getColor`: 1=track/disabled, 2=arrows, 3=thumb. Hit-zones `getPartCode` (`:114`, extent grown by
  (1,1)); `scrollStep` (`:283`, bit1 page/arrow, bit0 fwd/back); wheel = `±3·arStep` (`:148`/`:169`). Palette
  `cpScrollBar="\x04\x05\x05"` → gray-dialog **cyan-on-blue 0x13** (page=controls=thumb; PA-4/10).
- **`TScroller`** (`tscrolle.cpp`) — passive; driven by its scrollbars' `cmScrollBarChanged` broadcast
  (`:83`). `scrollDraw` (`:95`) mirrors `delta ← {h,v}ScrollBar.value` and repaints; `setLimit` (`:131`)
  sets bar range `[0, limit-size]`, **`pgStep = size-1`**. Palette `cpScroller="\x06\x07"` (PA-8).
- **`TListViewer`** (`tlstview.cpp:77`) — item `= j*size.y + i + topItem` (single col ⇒ `topItem+i`);
  `colWidth = size.x/numCols + 1`; **no `►` focus glyph** (focus = `focusedColor` + a hardware cursor we
  omit, PA-5); `getText(dest,item,255)` @ `curCol+1`, h-scrolled by `hScrollBar.value`; divider `│0xB3`
  `getColor(5)` @ right edge (off-screen for single col); `showMarkers` `»«`/`→←` are **mono-only**.
  `getColor`: 1 normal(active)/empty, 2 normal(inactive), 3 focused, 4 selected, 5 divider. `focusItem`
  (`:159`) mirrors into `vScrollBar.value` + keeps `topItem` visible. `selectItem` broadcasts
  `cmListItemSelected=56`. Palette `cpListViewer="\x1A\x1A\x1B\x1C\x1D"` → gray-dialog: normal
  **0x30 black-on-cyan**, focused **0x2F white-on-green**, selected **0x3E yellow-on-cyan**, divider
  **0x31 blue-on-cyan** (PA-10, hand-verified against `app.h:145-146`).
- **`TListBox`** (`tlistbox.cpp:52`) — inherits `TListViewer::draw`; `getText` = `items->at(item)`;
  `newList` (`:63`) sets `range=count`, focuses item 0 (PA-15).
- **`TSortedListBox`** (`stddlg.cpp:110`) — `searchPos` incremental prefix search over a sorted
  collection; RD-11 generalizes to a **linear** scan (PA-3).
- **`TDialog`** (`tdialog.cpp:25`) — **is-a `TWindow`** (TFrame chrome); `flags = wfMove|wfClose`
  (movable+closable, not resizable/zoomable), `wnNoNumber`, `palette = dpGrayDialog`, min `{16,6}`.
  `valid(cmd)` (`:95`): `cmCancel → True` (bypass), else `TGroup::valid` = `firstThat(isInvalid)` over
  children (`tgroup.cpp:566`). Commands `cmOK=10, cmCancel=11, cmYes=12, cmNo=13` (`views.h:44`). PA-6/7.
