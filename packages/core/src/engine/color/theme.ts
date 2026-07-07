/**
 * Semantic theme primitives (RD-05; AR-9).
 *
 * A typed {@link Theme} structure (named UI roles → colors) and the
 * {@link defaultTheme} — the classic Borland look migrated from the prototype
 * `theme.ts`. These are **data-only** primitives for the future UI layer, not the
 * UI itself: no view-tree mapping and no palette inheritance (RD-05 Won't-Have).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution
 * (it resolves to the `.ts` source during development via tsx).
 */
import type { Color } from '../render/types.js';

import { PALETTE } from './palette.js';

/** A foreground/background pair (+ optional hotkey accent) for a UI surface. */
export interface ThemeRole {
  readonly fg: Color;
  readonly bg: Color;
  /** Accent color for a highlighted hotkey character, when the role has one. */
  readonly hotkey?: Color;
}

/** Named semantic roles → colors. A data primitive for the future UI layer. */
export interface Theme {
  /** The desktop fill: a role plus the repeating pattern glyph. */
  readonly desktop: ThemeRole & { readonly pattern: string };
  readonly menuBar: ThemeRole;
  readonly menuSelected: ThemeRole;
  /**
   * The active (focused) window chrome. `icon` is the close/zoom glyph accent — Turbo Vision draws
   * the inner `■`/`↑`/`↕` and the resize grips in a brighter color than the frame brackets (TV
   * `cpFrame` palette index 5 = brightGreen on blue; `tframe.cpp:27,55`).
   */
  readonly window: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };
  /**
   * The **inactive** window chrome — a sibling of {@link window} mirroring its shape (fg/bg +
   * border/title + icon) so the UI layer's Frame can theme a background window distinctly from the
   * focused one. Additive, non-breaking (RD-05 AR-73 / the sole cross-package edit). `icon` is unused
   * (TV draws no title-bar icons on a passive window) but present for shape symmetry with {@link window}.
   */
  readonly windowInactive: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };
  /**
   * The gray dialog chrome (`cpGrayDialog`). `border`/`title` are the frame lines + title, `icon` the
   * close-box `[×]` inner-glyph accent — decoded from TV `TFrame` in a gray dialog: active `cFrame =
   * 0x0503` → lines `getColor(3)` = `cpFrame[2]`→gray slot 2→`cpAppColor[33]=0x7f` **white-on-lightGray**;
   * icon `getColor(5)`→slot 3→`cpAppColor[34]=0x7a` **brightGreen-on-lightGray**; title `getColor(4)=0x7f`
   * white (RD-11 PA-19; `tframe.cpp:60`, `dialogs.h:80`, `app.h`). The generalized `drawFrame` reads
   * `icon` for the dialog role just as it reads `window.icon`.
   */
  readonly dialog: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };
  readonly button: ThemeRole;
  readonly buttonFocused: ThemeRole;
  // --- jsvision-ui RD-06 essential-controls roles (the `cpGrayDialog` control palette) -----------
  // Faithful to Turbo Vision's gray-dialog palette: each role decodes `cpAppColor[cpGrayDialog[slot]]`
  // (`include/tvision/app.h:142`, `include/tvision/dialogs.h:80`). Buttons reuse {@link button} (slot
  // 10) / {@link buttonFocused} (slot 12); the bytes are pinned from source in the ST-02 spec oracle.
  /** Static text (TV gray-dialog slot 6, `0x70` black-on-lightGray). */
  readonly staticText: ThemeRole;
  /** Label normal text (slot 7, `0x70`). */
  readonly label: ThemeRole;
  /** Label when its linked control is focused (slot 8, `0x7F` white-on-lightGray). */
  readonly labelSelected: ThemeRole;
  /** Label `~hotkey~` accent (slot 9, `0x7E` yellow-on-lightGray). */
  readonly labelShortcut: ThemeRole;
  /** Default-button face when unfocused (slot 11, `0x2B` brightCyan-on-green). */
  readonly buttonDefault: ThemeRole;
  /** Disabled-button face (slot 13, `0x78` darkGray-on-lightGray). */
  readonly buttonDisabled: ThemeRole;
  /** Button `~hotkey~` accent (slot 14, `0x2E` yellow-on-green). */
  readonly buttonShortcut: ThemeRole;
  /**
   * Button drop-shadow blocks (`▄`/`█`/`▀`). TV `TButton::drawState` draws them in `getColor(8)`,
   * which resolves `cpButton[8]=0x0F` → `cpGrayDialog` slot 15 → `cpAppColor[0x2E]=0x70` =
   * black-on-lightGray — the dialog's own background with black ink, so the block glyphs paint the
   * shadow onto the grey field. This is NOT the window drop-shadow ({@link shadow}, darkGray-on-black).
   * (`tbutton.cpp:41` `cpButton` / `:121` `cShadow = getColor(8)` / `:143-146` shadow glyphs)
   */
  readonly buttonShadow: ThemeRole;
  /** Cluster (check/radio) item normal (slot 16, `0x30` black-on-cyan). */
  readonly clusterNormal: ThemeRole;
  /** Cluster focused item (slot 17, `0x3F` white-on-cyan). */
  readonly clusterSelected: ThemeRole;
  /** Cluster `~hotkey~` accent (slot 18, `0x3E` yellow-on-cyan). */
  readonly clusterShortcut: ThemeRole;
  /** Cluster disabled item (slot 31, `0x38` darkGray-on-cyan). */
  readonly clusterDisabled: ThemeRole;
  /**
   * Input-line field. Turbo Vision's `TInputLine::draw` fills with `getColor(sfFocused ? 2 : 1)`, but
   * `cpInputLine = "\x13\x13\x14\x15"` has **color-1 == color-2 == `0x13`** (`tinputli.cpp:84,139`) — so a
   * focused and an unfocused input draw the **same** attribute. Resolved: `getColor(1/2)` →
   * `cpGrayDialog[0x13]` (slot 19) → `cpAppColor[0x32]` = **`0x1F` white-on-blue**. Both {@link inputNormal}
   * and {@link inputSelected} therefore decode to `0x1F`; focus is signalled by the caret (RD-07), not colour.
   */
  readonly inputNormal: ThemeRole;
  /**
   * Input-line field when focused. **TV-faithful `0x1F` white-on-blue == {@link inputNormal}** (`getColor(2)`;
   * `tinputli.cpp:84,139`). Corrected from RD-06's `0x2F` green (PA-14, PF-004): RD-06 mis-named
   * `getColor(3)` — the text-**selection** colour, now {@link inputSelection} — as the focused-field colour.
   * TV marks focus with the blinking cursor (the RD-07 visible caret), not a distinct field colour.
   */
  readonly inputSelected: ThemeRole;
  /**
   * Input-line text-**selection** highlight (the reverse band over selected characters). TV
   * `TInputLine::draw` paints the selection in `getColor(3)` → `cpInputLine[3]=0x14` → `cpGrayDialog[0x14]`
   * (slot 20) → `cpAppColor[0x33]` = **`0x2F` white-on-green** (`tinputli.cpp:84,152-157`). Distinct from the
   * focused **field** ({@link inputSelected}); added for RD-07 Input selection (PA-4/PA-6).
   */
  readonly inputSelection: ThemeRole;
  /** Input-line `◄`/`►` scroll arrows (`getColor(4)` → slot 21, `0x1A` brightGreen-on-blue). */
  readonly inputArrows: ThemeRole;
  // --- jsvision-ui RD-11 container roles (scrollbar + list, `cpGrayDialog` palette) ---------------
  // Faithful to Turbo Vision's gray-dialog palette; each role decodes the component's own TV palette
  // byte through `cpGrayDialog` → `cpAppColor[N]` = `0xHL` (H=bg nibble, L=fg nibble). Bytes are
  // pinned from source in the ST-13 spec oracle (`theme-roles.spec`). (RD-11 PA-4/PA-10)
  /**
   * ScrollBar track / page area (the `▒`/`▓` fill). TV `cpScrollBar[1]=0x04` → gray-dialog slot 4 →
   * `cpAppColor[35]=0x13` = cyan-on-blue. (`tscrlbar.cpp:37`, `dialogs.h:80`, `app.h:145`)
   */
  readonly scrollBarPage: ThemeRole;
  /**
   * ScrollBar controls (the `▲▼◄►` arrows + the `■` thumb). TV `cpScrollBar[2..3]=0x05` → gray-dialog
   * slot 5 → `cpAppColor[36]=0x13` = cyan-on-blue. Page = controls = thumb share `0x13` in a gray
   * dialog; the glyph (`■` thumb vs `▒` track) is the visual distinction. (`tscrlbar.cpp:37`)
   */
  readonly scrollBarControls: ThemeRole;
  /**
   * ListView normal (unfocused) row. TV `cpListViewer[1]=0x1A` → gray-dialog slot 26 →
   * `cpAppColor[57]=0x30` = black-on-cyan. (`tlstview.cpp:30`, `app.h:146`)
   */
  readonly listNormal: ThemeRole;
  /**
   * ListView focused row (the primary focus signal in colour mode; PA-5 omits the hardware caret).
   * TV `cpListViewer[3]=0x1B` → gray-dialog slot 27 → `cpAppColor[58]=0x2F` = white-on-green.
   */
  readonly listFocused: ThemeRole;
  /**
   * ListView selected row. TV `cpListViewer[4]=0x1C` → gray-dialog slot 28 → `cpAppColor[59]=0x3E`
   * = yellow-on-cyan.
   */
  readonly listSelected: ThemeRole;
  /**
   * ListView inter-column divider `│` (off-screen for a single column). TV `cpListViewer[5]=0x1D` →
   * gray-dialog slot 29 → `cpAppColor[60]=0x31` = blue-on-cyan.
   */
  readonly listDivider: ThemeRole;
  /**
   * DataGrid header row (jsvision-ui RD-16, AR-172). A documented TV-EXTENSION colour — Turbo Vision
   * has no table class, so this is a design choice (not a getColor decode): `0x3F` = white-on-cyan —
   * a bright white heading on the same cyan field as the `cpListViewer` rows (cohesive, distinct
   * from black-on-cyan normal + yellow-on-cyan selected). Additive/non-breaking, the same pattern as
   * AR-97/112/122/139/149.
   */
  readonly tableHeader: ThemeRole;
  // --- jsvision-ui RD-14 History dropdown roles (`cpHistory`/`cpHistoryWindow`/`cpHistoryViewer`) --
  // Faithful to Turbo Vision's THistory chain, decoded for the gray-`TDialog` owner (this project's
  // default). Each byte resolves through its component palette → `cpGrayDialog` → `cpAppColor` = `0xHL`
  // (H=bg nibble, L=fg nibble). Bytes are pinned from source in the ST-32 spec oracle
  // (`history-theme.spec`). (RD-14 PA-12; input-dropdowns/03-01-history.md §1/§4, /03-04 §3)
  /**
   * History button `▐`/`▌` half-blocks (the "Sides"). TV `cpHistory[2]=0x17` (`thistory.cpp:37`) →
   * gray-dialog slot 23 → `cpAppColor[54]=0x72` = green-on-lightGray. (`dialogs.h:999-1002` layout)
   */
  readonly historyButtonSides: ThemeRole;
  /**
   * History button `↓` arrow. TV `cpHistory[1]=0x16` (`thistory.cpp:37`) → gray-dialog slot 22 →
   * `cpAppColor[53]=0x20` = black-on-green.
   */
  readonly historyButtonArrow: ThemeRole;
  /**
   * The History popup window. Mirrors the {@link window} role shape (interior fg/bg + `border` +
   * `icon`). TV `cpHistoryWindow="\x13\x13\x15\x18\x17\x13\x14"` (`thistwin.cpp:26`): the frame's
   * active border → entry 1 `0x13` → gray-dialog slot 19 → `cpAppColor[50]=0x1F` white-on-blue (so
   * the popup is a **blue** window even from a gray dialog); the icon/accent → entry 3 `0x15` →
   * slot 21 → `cpAppColor[52]=0x1A` brightGreen-on-blue (`tframe.cpp`).
   */
  readonly historyWindow: ThemeRole & { readonly border: Color; readonly icon: Color };
  /**
   * History list normal (unfocused/selected/divider) row. TV `cpHistoryViewer[1]=0x06`
   * (`thstview.cpp:33`) → `cpHistoryWindow[6]=0x13` → gray-dialog slot 19 → `cpAppColor[50]=0x1F` =
   * white-on-blue. (`tlstview.cpp:88-96`)
   */
  readonly historyViewer: ThemeRole;
  /**
   * History list focused row. TV `cpHistoryViewer[3]=0x07` → `cpHistoryWindow[7]=0x14` → gray-dialog
   * slot 20 → `cpAppColor[51]=0x2F` = white-on-green.
   */
  readonly historyViewerFocused: ThemeRole;
  // --- jsvision-ui RD-15 Tree/outline roles (`cpOutlineViewer` → blue-window owner) ----------------
  // Faithful to Turbo Vision's `TOutlineViewer` palette, decoded for the blue `TWindow` owner — the
  // canonical outline host (RD-15 PA-16, superseding PA-9's gray-dialog pin, which resolved
  // Normal==Focus==0x70 and hid the focus row). Each byte resolves `cpOutlineViewer` slot →
  // `cpBlueWindow` → `cpAppColor` = `0xHL` (H=bg nibble, L=fg nibble). Bytes are pinned from source in
  // the ST-20 spec oracle (`outline-theme.spec`). (`toutline.cpp:15`, `outline.h:66-70`,
  // `views.h:955`, `app.h:143`)
  /**
   * Outline/tree normal row (an expanded node's or a leaf's text). TV `cpOutlineViewer[1]=0x06` →
   * `cpBlueWindow[6]=0x0D` → `cpAppColor[13]=0x1E` = yellow-on-blue. (`toutline.cpp:71` `getColor(0x0401)` low byte)
   */
  readonly outlineNormal: ThemeRole;
  /**
   * Outline/tree focused row. TV `cpOutlineViewer[2]=0x07` → `cpBlueWindow[7]=0x0E` →
   * `cpAppColor[14]=0x71` = blue-on-lightGray (a distinct inverted bar). (`toutline.cpp:67` `getColor(0x0202)`)
   */
  readonly outlineFocused: ThemeRole;
  /**
   * Outline/tree selected row. TV `cpOutlineViewer[3]=0x03` → `cpBlueWindow[3]=0x0A` →
   * `cpAppColor[10]=0x1A` = brightGreen-on-blue. (`toutline.cpp:69` `getColor(0x0303)`)
   */
  readonly outlineSelected: ThemeRole;
  /**
   * Outline/tree collapsed-node text (the two-tone `color >> 8` high byte, `toutline.cpp:82`). TV
   * `cpOutlineViewer[4]=0x08` → `cpBlueWindow[8]=0x0F` → `cpAppColor[15]=0x1F` = white-on-blue — the
   * high byte of the Normal pair `getColor(0x0401)`.
   */
  readonly outlineNotExpanded: ThemeRole;
  // --- jsvision-ui RD-17 Tabs roles (`tab*`, a documented TV-EXTENSION — TV button-face palette) ---
  // Turbo Vision has NO tab/notebook class (RD-17 AR-172/GATE-1), so these three are *documented
  // extension* colours. RD-17 shipped folder tabs as raised BUTTON FACES (design adopted post-spike),
  // so the roles are grounded in TV's `cpButton` green palette, NOT invented: a tab reads like a
  // `TButton` face — inactive = the normal face `cpButton` `0x20` black-on-green, active = the brighter
  // focused/default face `0x2F` white-on-green, both with the `0x2E` yellow shortcut accent; disabled =
  // the `0x28` darkGray greying kept ON the green field (green-dimmed, so a disabled tab stays part of
  // the strip). No drop-shadow is drawn (tabs are flat). The frame chrome (corners/edges/`─` gaps) uses
  // {@link staticText} (`0x70` black-on-lightGray), not a tab role. `0xHL`: H=bg, L=fg. Additive (AC-11).
  /**
   * Active (selected) tab — the brighter, "raised" button face. Grounded in the TV `buttonFocused`
   * face `cpButton` focused → `0x2F` white-on-green; `hotkey` = the `0x2E` yellow shortcut for the
   * `~X~` marked letter. (`theme.ts` {@link buttonFocused}, RD-17 AR-180)
   */
  readonly tabActive: ThemeRole;
  /**
   * Inactive tab — the normal button face `cpButton` `0x20` black-on-green (mirrors {@link button}),
   * with the `0x2E` yellow `~X~` shortcut accent shown on every enabled tab. (RD-17 AR-180)
   */
  readonly tabInactive: ThemeRole;
  /**
   * Disabled tab — the `buttonDisabled`/`clusterDisabled` `0x28` darkGray greying kept on the green
   * field (green-dimmed) so a disabled tab stays visually part of the strip; no hotkey accent (never
   * activatable). (RD-17 AR-180)
   */
  readonly tabDisabled: ThemeRole;
  /**
   * Progress-bar fill (RD-18, PA-3). Documented TV-extension colour — TV has no gauge/progress
   * palette (AR-186 whole-tree search), so there is no `getColor` chain to decode; grounded in the
   * shipped cyan-on-blue scrollbar-gauge family as `0x1B` brightCyan-on-blue, a *brighter* sibling of
   * {@link scrollBarPage}/{@link scrollBarControls} `0x13`. Paints the `█`/eighth-block sub-cell fill
   * (and the whole-cell `#` ASCII fill). `0xHL`: H=bg nibble, L=fg nibble. Additive (AC-11).
   */
  readonly progressFill: ThemeRole;
  /**
   * Progress-bar track (RD-18, PA-3). `0x13` cyan-on-blue — identical to {@link scrollBarPage}, the
   * dim shade of the same gauge family; the fill reads brighter than the track on the shared blue
   * field. Paints the `░` track (and the whole-cell `-` ASCII track). Additive (AC-11).
   */
  readonly progressTrack: ThemeRole;
  /**
   * Calendar in-month day — the `Calendar` month-grid normal cell (RD-20, PA-3). **TV-decoded**
   * through the `getColor` chain: `TCalendarView` sits in a `wpCyanWindow` window (`calendar.cpp:277`),
   * `getColor(6)` → `cpCyanWindow[6]=0x15` → `cpAppColor[21]=0x3E` **yellow-on-cyan** (`calendar.cpp:134,163`).
   * `0xHL`: H=bg nibble, L=fg nibble. Additive (AC-14).
   */
  readonly calendarNormal: ThemeRole;
  /**
   * Calendar "today" cell — the highlighted current date (RD-20, PA-3). **TV-decoded**: `getColor(7)`
   * → `cpCyanWindow[7]=0x16` → `cpAppColor[22]=0x21` **blue-on-green** (`calendar.cpp:135,165`). Additive.
   */
  readonly calendarToday: ThemeRole;
  /**
   * Calendar selected day — the committed `value` cell (RD-20 extension, PA-2). `0x1F` white-on-blue:
   * a distinct blue cell against the cyan grid; wins over `calendarToday` when they coincide (PA-4).
   * TV has no day selection, so this is a grounded design byte (not a `getColor` decode). Additive.
   */
  readonly calendarSelected: ThemeRole;
  /**
   * Calendar focus cursor — the navigable focus cell, drawn **only while the Calendar has focus**,
   * highest precedence (RD-20 extension, PA-1). `0xF0` black-on-white: a **filled reverse block** so the
   * focused day reads as a solid highlight (not a fg-only tint) against the cyan grid — distinct from
   * the selected cell's blue bg (PA-19-runtime, user request 2026-07-04). TV has no day cursor. Additive.
   */
  readonly calendarCursor: ThemeRole;
  /**
   * Calendar disabled day — a dimmed, navigable-but-non-committable day (RD-20 extension, PA-2).
   * `0x38` darkGray-on-cyan, mirroring the shipped {@link clusterDisabled} greying family. Additive.
   */
  readonly calendarDisabled: ThemeRole;
  /**
   * Calendar ISO week-number column — the opt-in leading `NN` column (RD-20 extension, PA-2). `0x30`
   * black-on-cyan, muted on the cyan grid. Each row labelled by its Thursday's ISO week (PA-10). Additive.
   */
  readonly calendarWeekNumber: ThemeRole;
  /**
   * Color-swatch marker — the forced-contrast `◘` selection marker on a near-black cell (jsvision-ui
   * RD-21, PA-1/PA-2). **TV-decoded**: `TColorSelector::draw()` forces the `◘` marker on a black cell
   * to attr `0x70` (`colorsel.cpp:135-136`) so it stays visible against the black cell background.
   * `colorMarker` pins that byte: `0x70` = black (`0`) on lightGray (`7`). RD-21 fires it on
   * **near-black** cells (the generic extension of TV's exact `c==0`, PA-2); a normal cell's marker
   * uses the cell's own `Color`. Additive.
   */
  readonly colorMarker: ThemeRole;
  /**
   * File-dialog info pane — the read-out strip below a `TFileDialog` showing the expanded path + the
   * focused entry's name/size/date/time (jsvision-ui RD-09, PA-6). **TV-decoded**: `TFileInfoPane`'s
   * `getColor(1)` resolves `cpInfoPane[1]=0x1E` (`stddlg.cpp:67`) → gray-dialog `cpGrayDialog[30]=0x3D`
   * (`dialogs.h:80`) → `cpAppColor[0x3D=61]=0x13` (`app.h:142`) = `0x13` cyan (`3`) on blue (`1`) — TV's
   * blue info strip under the gray dialog. `0x13` exists only as domain-alien scrollbar/progress roles,
   * so RD-09 pins it as its own semantic role (the RD-21 `colorMarker` precedent). Additive.
   */
  readonly fileInfo: ThemeRole;
  // --- jsvision-ui RD-08 editor family (register PA-8; all seven TV-decoded, re-verified at exec
  // GATE-1 2026-07-07 vs magiblot/tvision @ 57b6f56; distinct roles pinned even where bytes
  // coincide — the fileInfo precedent). Bytes hold under the color palette `cpAppColor`
  // (`app.h:142`); B/W-monochrome palettes are out of scope. ---
  /**
   * Editor text — the `Editor`/`Memo`-family normal cell (jsvision-ui RD-08, PA-8). **TV-decoded**:
   * `cpEditor "\x06"` (`teditor1.cpp:171,496-500`) → `cpBlueWindow[6]=0x0D` (`views.h:955`) →
   * `cpAppColor[13]` = **`0x1E` yellow-on-blue** (`app.h:143`). Additive.
   */
  readonly editorNormal: ThemeRole;
  /**
   * Editor selected text (jsvision-ui RD-08, PA-8). **TV-decoded**: `cpEditor "\x07"` →
   * `cpBlueWindow[7]=0x0E` → `cpAppColor[14]` = **`0x71` blue-on-lightGray** — the reverse-video
   * selection band `drawLines` fetches via `getColor(0x0201)` (`teditor1.cpp:466`). Additive.
   */
  readonly editorSelected: ThemeRole;
  /**
   * Memo normal cell — the dialog-embedded editor (jsvision-ui RD-08, PA-8). **TV-decoded**:
   * `cpMemo "\x1A"` (`tmemo.cpp:27`) → `cpGrayDialog[26]=0x39` (`dialogs.h:80-82`) →
   * `cpAppColor[57]` = **`0x30` black-on-cyan** (`app.h:146`). Additive.
   */
  readonly memoNormal: ThemeRole;
  /**
   * Memo selected text (jsvision-ui RD-08, PA-8). **TV-decoded**: `cpMemo "\x1B"` →
   * `cpGrayDialog[27]=0x3A` → `cpAppColor[58]` = **`0x2F` white-on-green**. Additive.
   */
  readonly memoSelected: ThemeRole;
  /**
   * Indicator resting state — the `line:col` strip in an `EditWindow`'s bottom border (jsvision-ui
   * RD-08, PA-8). **TV-decoded**: `cpIndicator "\x02"` (`tindictr.cpp:27`) → `cpBlueWindow[2]=0x09`
   * → `cpAppColor[9]` = **`0x1F` white-on-blue**; drawn with the `═` (`dragFrame` `\xCD`) fill
   * while NOT dragging (`tindictr.cpp:44-53`, `tvtext1.cpp:83-84`). Additive.
   */
  readonly indicatorNormal: ThemeRole;
  /**
   * Indicator while its window drags (jsvision-ui RD-08, PA-8). **TV-decoded**: `cpIndicator
   * "\x03"` → `cpBlueWindow[3]=0x0A` → `cpAppColor[10]` = **`0x1A` brightGreen-on-blue**; drawn
   * with the `─` (`normalFrame` `\xC4`) fill while `sfDragging` (`tindictr.cpp:44-53`). Additive.
   */
  readonly indicatorDragging: ThemeRole;
  /**
   * Terminal text — the streaming log sink (jsvision-ui RD-08, PA-8). **TV-decoded**: `TTerminal`
   * draws via `mapColor(1)` (`textview.cpp:125`) through `cpScroller "\x06"` (`tscrolle.cpp:35`) →
   * `cpBlueWindow[6]=0x0D` → `cpAppColor[13]` = **`0x1E` yellow-on-blue**. Additive.
   */
  readonly terminalNormal: ThemeRole;
  readonly statusBar: ThemeRole;
  /**
   * The status-line **pressed/selected** item (mouse-down feedback). Turbo Vision repaints the held
   * item in `cSelect` = black-on-green, with a red-on-green hotkey run (`tstatusl.cpp` `drawSelect`,
   * `0x20`/`0x24`). A sibling of {@link statusBar}, mirroring {@link menuSelected}'s relationship to
   * {@link menuBar}. (RD-10 AR-88)
   */
  readonly statusSelected: ThemeRole;
  readonly shadow: ThemeRole;
}

/**
 * The classic Borland / Turbo Vision look, mapped from the original `cpAppColor` palette
 * (`magiblot/tvision` `include/tvision/app.h:142` — the source-of-truth per the project's fidelity
 * directive). Each role's (fg, bg) pair is the decode of the corresponding `cpAppColor` attribute
 * byte (`0xHL`: high nibble = bg, low nibble = fg). Roles are plain data — no inheritance, no view
 * mapping (AR-9).
 *
 * Key bytes: desktop `0x71` = blue ░ on lightGray (a muted steel field); the default window is the
 * **blue** `cpBlueWindow` — active frame/title `0x1F` white-on-blue, passive `0x17` lightGray-on-blue,
 * icon accent `0x1A` brightGreen-on-blue; menu/status selected `0x20`/`0x24` black & red on green. The
 * gray `dialog` palette (`cpGrayDialog`, black-on-lightGray) is distinct from the blue window.
 */
export const defaultTheme: Theme = {
  desktop: { pattern: '\u2591', fg: PALETTE.blue, bg: PALETTE.lightGray }, // ░
  menuBar: { fg: PALETTE.black, bg: PALETTE.lightGray, hotkey: PALETTE.red },
  menuSelected: { fg: PALETTE.black, bg: PALETTE.green, hotkey: PALETTE.red },
  window: {
    fg: PALETTE.white,
    bg: PALETTE.blue,
    border: PALETTE.white,
    title: PALETTE.white,
    icon: PALETTE.brightGreen,
  },
  windowInactive: {
    fg: PALETTE.lightGray,
    bg: PALETTE.blue,
    border: PALETTE.lightGray,
    title: PALETTE.lightGray,
    icon: PALETTE.lightGray,
  },
  // Gray dialog frame decoded TV-faithful (PA-19): white lines/title, brightGreen icon accent.
  dialog: {
    fg: PALETTE.black,
    bg: PALETTE.lightGray,
    border: PALETTE.white,
    title: PALETTE.white,
    icon: PALETTE.brightGreen,
  },
  button: { fg: PALETTE.black, bg: PALETTE.green },
  buttonFocused: { fg: PALETTE.white, bg: PALETTE.green, hotkey: PALETTE.yellow },
  // RD-06 control roles — decoded from `cpAppColor[cpGrayDialog[slot]]` (app.h:142 / dialogs.h:80).
  staticText: { fg: PALETTE.black, bg: PALETTE.lightGray },
  label: { fg: PALETTE.black, bg: PALETTE.lightGray },
  labelSelected: { fg: PALETTE.white, bg: PALETTE.lightGray },
  labelShortcut: { fg: PALETTE.yellow, bg: PALETTE.lightGray },
  buttonDefault: { fg: PALETTE.brightCyan, bg: PALETTE.green },
  buttonDisabled: { fg: PALETTE.darkGray, bg: PALETTE.lightGray },
  buttonShortcut: { fg: PALETTE.yellow, bg: PALETTE.green },
  buttonShadow: { fg: PALETTE.black, bg: PALETTE.lightGray },
  clusterNormal: { fg: PALETTE.black, bg: PALETTE.cyan },
  clusterSelected: { fg: PALETTE.white, bg: PALETTE.cyan },
  clusterShortcut: { fg: PALETTE.yellow, bg: PALETTE.cyan },
  clusterDisabled: { fg: PALETTE.darkGray, bg: PALETTE.cyan },
  inputNormal: { fg: PALETTE.white, bg: PALETTE.blue },
  // TV-faithful: focused field == unfocused (cpInputLine color-1==color-2==0x1F); PA-14/PF-004.
  inputSelected: { fg: PALETTE.white, bg: PALETTE.blue },
  // getColor(3) text-selection highlight (0x2F white-on-green); was mis-named `inputSelected` in RD-06.
  inputSelection: { fg: PALETTE.white, bg: PALETTE.green },
  inputArrows: { fg: PALETTE.brightGreen, bg: PALETTE.blue },
  // RD-11 container roles — decoded gray-dialog bytes (PA-10): scrollbar 0x13 cyan-on-blue; list
  // normal 0x30 black-on-cyan, focused 0x2F white-on-green, selected 0x3E yellow-on-cyan, divider
  // 0x31 blue-on-cyan.
  scrollBarPage: { fg: PALETTE.cyan, bg: PALETTE.blue },
  scrollBarControls: { fg: PALETTE.cyan, bg: PALETTE.blue },
  listNormal: { fg: PALETTE.black, bg: PALETTE.cyan },
  listFocused: { fg: PALETTE.white, bg: PALETTE.green },
  listSelected: { fg: PALETTE.yellow, bg: PALETTE.cyan },
  listDivider: { fg: PALETTE.blue, bg: PALETTE.cyan },
  tableHeader: { fg: PALETTE.white, bg: PALETTE.cyan }, // 0x3F white-on-cyan (RD-16, AR-172)
  // RD-14 History dropdown roles — decoded TV bytes (PA-12): button sides 0x72 green-on-lightGray,
  // arrow 0x20 black-on-green; blue popup window 0x1F white-on-blue border, 0x1A brightGreen icon;
  // viewer 0x1F white-on-blue, focused 0x2F white-on-green.
  historyButtonSides: { fg: PALETTE.green, bg: PALETTE.lightGray },
  historyButtonArrow: { fg: PALETTE.black, bg: PALETTE.green },
  historyWindow: { fg: PALETTE.white, bg: PALETTE.blue, border: PALETTE.white, icon: PALETTE.brightGreen },
  historyViewer: { fg: PALETTE.white, bg: PALETTE.blue },
  historyViewerFocused: { fg: PALETTE.white, bg: PALETTE.green },
  // RD-15 Tree/outline roles — decoded blue-window bytes (PA-16): normal 0x1E yellow-on-blue,
  // focused 0x71 blue-on-lightGray, selected 0x1A brightGreen-on-blue, notExpanded 0x1F white-on-blue.
  outlineNormal: { fg: PALETTE.yellow, bg: PALETTE.blue },
  outlineFocused: { fg: PALETTE.blue, bg: PALETTE.lightGray },
  outlineSelected: { fg: PALETTE.brightGreen, bg: PALETTE.blue },
  outlineNotExpanded: { fg: PALETTE.white, bg: PALETTE.blue },
  // RD-17 Tabs roles — TV button-face palette (GATE-1, plans/tabs/03-03 §GATE-1): active 0x2F
  // white-on-green (focused face), inactive 0x20 black-on-green (normal face), disabled 0x28
  // darkGray-on-green (green-dimmed). Active + inactive carry the 0x2E yellow shortcut on every tab.
  tabActive: { fg: PALETTE.white, bg: PALETTE.green, hotkey: PALETTE.yellow },
  tabInactive: { fg: PALETTE.black, bg: PALETTE.green, hotkey: PALETTE.yellow },
  tabDisabled: { fg: PALETTE.darkGray, bg: PALETTE.green },
  // RD-18 Feedback roles — documented TV-extension colours (TV has no gauge palette, AR-186), grounded
  // in the cyan-on-blue scrollbar-gauge family (plans/feedback/03-03 §GATE-1, PA-3): fill 0x1B
  // brightCyan-on-blue (brighter sibling of scrollBarPage), track 0x13 cyan-on-blue (= scrollBarPage).
  progressFill: { fg: PALETTE.brightCyan, bg: PALETTE.blue },
  progressTrack: { fg: PALETTE.cyan, bg: PALETTE.blue },
  // RD-20 Calendar roles (plans/date-family/00-ambiguity-register.md PA-2/PA-3). Two TV-decoded via
  // wpCyanWindow → cpAppColor (calendar.cpp): normal 0x3E yellow-on-cyan (getColor(6)), today 0x21
  // blue-on-green (getColor(7)). Four extensions (TV has no selection/cursor/disabled/week#): selected
  // 0x1F white-on-blue, cursor 0x3F white-on-cyan, disabled 0x38 darkGray-on-cyan (clusterDisabled
  // family), weekNumber 0x30 black-on-cyan.
  calendarNormal: { fg: PALETTE.yellow, bg: PALETTE.cyan },
  calendarToday: { fg: PALETTE.blue, bg: PALETTE.green },
  calendarSelected: { fg: PALETTE.white, bg: PALETTE.blue },
  calendarCursor: { fg: PALETTE.black, bg: PALETTE.white },
  calendarDisabled: { fg: PALETTE.darkGray, bg: PALETTE.cyan },
  calendarWeekNumber: { fg: PALETTE.black, bg: PALETTE.cyan },
  // RD-21 Color family (plans/color-family/00-ambiguity-register.md PA-1/PA-2). TV-decoded: the `◘`
  // marker's forced-contrast byte on a black cell (colorsel.cpp:136), fired on near-black cells.
  colorMarker: { fg: PALETTE.black, bg: PALETTE.lightGray }, // 0x70 black-on-lightGray
  // RD-09 file-dialog info pane — TV-decoded 0x13 cyan-on-blue (TFileInfoPane getColor(1):
  // cpInfoPane[1]=0x1E → cpGrayDialog[30]=0x3D → cpAppColor[61]=0x13; stddlg.cpp:67/app.h:142). Additive.
  fileInfo: { fg: PALETTE.cyan, bg: PALETTE.blue },
  // --- jsvision-ui RD-08 editor family — TV-decoded bytes (PA-8, exec GATE-1 re-verified): editor
  // 0x1E/0x71 (cpEditor→cpBlueWindow→cpAppColor), memo 0x30/0x2F (cpMemo→cpGrayDialog), indicator
  // 0x1F resting ═ / 0x1A dragging ─ (cpIndicator→cpBlueWindow), terminal 0x1E (cpScroller). ---
  editorNormal: { fg: PALETTE.yellow, bg: PALETTE.blue }, // 0x1E
  editorSelected: { fg: PALETTE.blue, bg: PALETTE.lightGray }, // 0x71
  memoNormal: { fg: PALETTE.black, bg: PALETTE.cyan }, // 0x30
  memoSelected: { fg: PALETTE.white, bg: PALETTE.green }, // 0x2F
  indicatorNormal: { fg: PALETTE.white, bg: PALETTE.blue }, // 0x1F
  indicatorDragging: { fg: PALETTE.brightGreen, bg: PALETTE.blue }, // 0x1A
  terminalNormal: { fg: PALETTE.yellow, bg: PALETTE.blue }, // 0x1E
  statusBar: { fg: PALETTE.black, bg: PALETTE.lightGray, hotkey: PALETTE.red },
  statusSelected: { fg: PALETTE.black, bg: PALETTE.green, hotkey: PALETTE.red },
  shadow: { fg: PALETTE.darkGray, bg: PALETTE.black },
};
