/**
 * The semantic theme model: named UI roles mapped to colors.
 *
 * A {@link Theme} is plain data — a lookup from a role name (e.g. `menuBar`,
 * `button`, `listFocused`) to a foreground/background pair (plus an optional
 * hotkey accent). {@link defaultTheme} is the classic DOS-era "gray dialog /
 * blue window" look, ready to use out of the box. Assign a role's colors to the
 * cells you draw; the theme itself has no view-tree or inheritance behavior.
 */
import type { AttrMask, Color } from '../render/types.js';

import { PALETTE } from './palette.js';

/** A foreground/background pair (+ optional hotkey accent) for a UI surface. */
export interface ThemeRole {
  readonly fg: Color;
  readonly bg: Color;
  /** Accent color for a highlighted hotkey character, when the role has one. */
  readonly hotkey?: Color;
  /**
   * Optional text-attribute mask (dim/bold/italic/underline/…) applied when the
   * role is painted. Omitted on every {@link defaultTheme} role; an
   * attribute-driven theme (e.g. a monochrome preset) uses it to distinguish
   * states without color. Attributes render even at `mono` depth.
   */
  readonly attrs?: AttrMask;
}

/** Named semantic UI roles mapped to colors. See {@link defaultTheme}. */
export interface Theme {
  /** The desktop fill: a role plus the repeating pattern glyph tiled across it. */
  readonly desktop: ThemeRole & { readonly pattern: string };
  /** The top menu bar. */
  readonly menuBar: ThemeRole;
  /** The highlighted (hovered/open) menu item. */
  readonly menuSelected: ThemeRole;
  /**
   * The active (focused) window chrome. `border`/`title` color the frame lines
   * and title text; `icon` is the brighter accent used for the close/zoom glyphs
   * and the resize grips so they stand out from the frame.
   */
  readonly window: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };
  /**
   * The **inactive** (background) window chrome — the same shape as {@link window}
   * (fg/bg + border/title + icon) but dimmed, so a background window reads as
   * distinct from the focused one. `icon` is present for shape symmetry but an
   * inactive window draws no title-bar icons.
   */
  readonly windowInactive: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };
  /**
   * The gray dialog chrome. `border`/`title` color the frame lines and title;
   * `icon` is the accent for the close-box `[×]` glyph. The gray dialog palette
   * is deliberately distinct from the blue {@link window}.
   */
  readonly dialog: ThemeRole & { readonly border: Color; readonly title: Color; readonly icon: Color };
  /** A normal command button face. */
  readonly button: ThemeRole;
  /** A focused command button face. */
  readonly buttonFocused: ThemeRole;
  // --- Dialog control roles (static text, labels, buttons, clusters, inputs) ---
  /** Static (non-interactive) text: black on lightGray. */
  readonly staticText: ThemeRole;
  /** A control label's normal text: black on lightGray. */
  readonly label: ThemeRole;
  /** A label when its linked control is focused: white on lightGray. */
  readonly labelSelected: ThemeRole;
  /** A label's `~hotkey~` accent character: yellow on lightGray. */
  readonly labelShortcut: ThemeRole;
  /** The default button's face when unfocused: brightCyan on green. */
  readonly buttonDefault: ThemeRole;
  /** A disabled button's face: darkGray on lightGray. */
  readonly buttonDisabled: ThemeRole;
  /** A button's `~hotkey~` accent character: yellow on green. */
  readonly buttonShortcut: ThemeRole;
  /**
   * The button's drop-shadow blocks (`▄`/`█`/`▀`): black on lightGray. Painting
   * black block glyphs over the dialog's own gray field produces the shadow.
   * This is NOT the window drop-shadow ({@link shadow}, darkGray on black).
   */
  readonly buttonShadow: ThemeRole;
  /** A check/radio cluster item, normal: black on cyan. */
  readonly clusterNormal: ThemeRole;
  /** A check/radio cluster item, focused: white on cyan. */
  readonly clusterSelected: ThemeRole;
  /** A cluster item's `~hotkey~` accent: yellow on cyan. */
  readonly clusterShortcut: ThemeRole;
  /** A disabled cluster item: darkGray on cyan. */
  readonly clusterDisabled: ThemeRole;
  /**
   * An input-line field, unfocused: white on blue. A focused field uses the same
   * color ({@link inputSelected}) — focus is signalled by the blinking caret, not
   * by a color change. The reverse-video highlight over a text selection is a
   * separate role, {@link inputSelection}.
   */
  readonly inputNormal: ThemeRole;
  /** An input-line field, focused: white on blue — the same as {@link inputNormal}. */
  readonly inputSelected: ThemeRole;
  /**
   * The highlight band over selected text inside an input line: white on green.
   * Distinct from the focused **field** color ({@link inputSelected}).
   */
  readonly inputSelection: ThemeRole;
  /** The input-line `◄`/`►` scroll arrows shown when text overflows: brightGreen on blue. */
  readonly inputArrows: ThemeRole;
  // --- Scrollbar + list roles ---
  /**
   * A scrollbar's track / page area (the `▒`/`▓` fill): cyan on blue. The track
   * and the controls share a color; the glyph (`■` thumb vs `▒` track) is the
   * visual distinction.
   */
  readonly scrollBarPage: ThemeRole;
  /** A scrollbar's controls — the `▲▼◄►` arrows and the `■` thumb: cyan on blue. */
  readonly scrollBarControls: ThemeRole;
  /** A list's normal (unfocused) row: black on cyan. */
  readonly listNormal: ThemeRole;
  /** A list's focused row — the primary focus signal in color mode: white on green. */
  readonly listFocused: ThemeRole;
  /** A list's selected row: yellow on cyan. */
  readonly listSelected: ThemeRole;
  /** A list's inter-column divider `│` (unused for a single-column list): blue on cyan. */
  readonly listDivider: ThemeRole;
  /**
   * A data-grid header row: white on cyan — a bright heading over the same cyan
   * field as the {@link listNormal} rows, distinct from both normal (black-on-cyan)
   * and selected (yellow-on-cyan) rows.
   */
  readonly tableHeader: ThemeRole;
  // --- History dropdown roles ---
  /** The history dropdown button's `▐`/`▌` half-block sides: green on lightGray. */
  readonly historyButtonSides: ThemeRole;
  /** The history dropdown button's `↓` arrow: black on green. */
  readonly historyButtonArrow: ThemeRole;
  /**
   * The history popup window — the same shape as {@link window} (interior fg/bg +
   * `border` + `icon`). It renders as a **blue** window (white-on-blue border,
   * brightGreen icon accent) even when opened from a gray dialog.
   */
  readonly historyWindow: ThemeRole & { readonly border: Color; readonly icon: Color };
  /** A history list's normal (unfocused) row: white on blue. */
  readonly historyViewer: ThemeRole;
  /** A history list's focused row: white on green. */
  readonly historyViewerFocused: ThemeRole;
  // --- Tree / outline roles (a blue-window host) ---
  /** An outline/tree normal row (an expanded node or a leaf): yellow on blue. */
  readonly outlineNormal: ThemeRole;
  /** An outline/tree focused row — a distinct inverted bar: blue on lightGray. */
  readonly outlineFocused: ThemeRole;
  /** An outline/tree selected row: brightGreen on blue. */
  readonly outlineSelected: ThemeRole;
  /** An outline/tree collapsed-node's text: white on blue. */
  readonly outlineNotExpanded: ThemeRole;
  // --- Tab roles (raised button-face folder tabs) ---
  /**
   * The active (selected) tab — the brighter, "raised" button face: white on
   * green, with a yellow accent for the `~X~` hotkey letter.
   */
  readonly tabActive: ThemeRole;
  /** An inactive tab — the normal button face: black on green, with a yellow `~X~` hotkey accent. */
  readonly tabInactive: ThemeRole;
  /** A disabled tab — dimmed but kept on the green field so it stays part of the strip: darkGray on green. */
  readonly tabDisabled: ThemeRole;
  /**
   * A progress bar's filled portion: brightCyan on blue — a brighter sibling of
   * {@link scrollBarPage}. Paints the `█`/eighth-block sub-cell fill (and the
   * whole-cell `#` fill in ASCII mode).
   */
  readonly progressFill: ThemeRole;
  /**
   * A progress bar's unfilled track: cyan on blue (identical to {@link scrollBarPage}),
   * so the fill reads brighter than the track on the shared blue field. Paints the
   * `░` track (and the whole-cell `-` track in ASCII mode).
   */
  readonly progressTrack: ThemeRole;
  /**
   * A slider's groove — the `─`/`│` rule the thumb travels along: a dim
   * darkGray-on-lightGray line on the gray dialog field where sliders live.
   */
  readonly sliderTrack: ThemeRole;
  /**
   * A slider's thumb — the `█` block marking the current value: a solid
   * blue-on-lightGray block, brighter than the {@link sliderTrack} groove.
   */
  readonly sliderThumb: ThemeRole;
  /** A calendar's in-month day cell (normal): yellow on cyan. */
  readonly calendarNormal: ThemeRole;
  /** A calendar's "today" cell — the highlighted current date: blue on green. */
  readonly calendarToday: ThemeRole;
  /**
   * A calendar's selected day — the committed value cell: white on blue, a
   * distinct blue cell against the cyan grid. Takes precedence over
   * {@link calendarToday} when they coincide.
   */
  readonly calendarSelected: ThemeRole;
  /**
   * A calendar's focus cursor — the navigable focus cell, drawn **only while the
   * calendar has focus**, at highest precedence: black on white (a filled reverse
   * block) so the focused day reads as a solid highlight against the cyan grid.
   */
  readonly calendarCursor: ThemeRole;
  /** A calendar's disabled day — dimmed but still navigable: darkGray on cyan. */
  readonly calendarDisabled: ThemeRole;
  /** A calendar's ISO week-number column (the opt-in leading `NN` column): black on cyan. */
  readonly calendarWeekNumber: ThemeRole;
  /**
   * The forced-contrast `◘` selection marker drawn on a near-black color-swatch
   * cell: black on lightGray, so the marker stays visible against the dark cell.
   * A normal (non-dark) cell's marker uses the cell's own color instead.
   */
  readonly colorMarker: ThemeRole;
  /**
   * The focused **cell** highlight in an editable data grid — a filled
   * black-on-white reverse block drawn over the focused row so the cursor cell
   * reads distinctly inside the row highlight. Painted only while the grid body
   * has focus.
   */
  readonly gridCursor: ThemeRole;
  /**
   * The pending-commit marker colour in an editable data grid: the `•` drawn on a
   * cell whose edit has not yet been confirmed. Its foreground is composited over
   * the cell's own background at draw time, so the stored background is nominal.
   */
  readonly gridDirty: ThemeRole;
  /**
   * A file dialog's info pane — the strip below the dialog that reads out the
   * expanded path and the focused entry's name/size/date/time: cyan on blue.
   */
  readonly fileInfo: ThemeRole;
  // --- Editor family (editor / memo / indicator / terminal) ---
  /** Editor text — an editor/memo body's normal cell: yellow on blue. */
  readonly editorNormal: ThemeRole;
  /** Editor selected text — the reverse-video selection band: blue on lightGray. */
  readonly editorSelected: ThemeRole;
  /** A dialog-embedded memo's normal cell: black on cyan. */
  readonly memoNormal: ThemeRole;
  /** A memo's selected text: white on green. */
  readonly memoSelected: ThemeRole;
  /**
   * The `line:col` indicator in an editor window's bottom border, at rest: white
   * on blue, drawn over a `═` fill while the window is not being dragged.
   */
  readonly indicatorNormal: ThemeRole;
  /**
   * The `line:col` indicator while its window is being dragged: brightGreen on
   * blue, drawn over a `─` fill.
   */
  readonly indicatorDragging: ThemeRole;
  /** Terminal text — a streaming log sink's normal cell: yellow on blue. */
  readonly terminalNormal: ThemeRole;
  /** The status line. */
  readonly statusBar: ThemeRole;
  /**
   * The status-line **pressed/selected** item (mouse-down feedback): black on
   * green, with a red-on-green hotkey run. The pressed counterpart of
   * {@link statusBar}, mirroring how {@link menuSelected} relates to {@link menuBar}.
   */
  readonly statusSelected: ThemeRole;
  /** The window drop-shadow: darkGray on black. */
  readonly shadow: ThemeRole;
}

/**
 * The classic DOS text-mode look — a "gray dialog / blue window" theme
 * ready to use as-is or as the base for your own. Each role's `(fg, bg)` pair is
 * a plain {@link Color} from {@link PALETTE}; roles carry no inheritance or
 * view-mapping behavior.
 *
 * Highlights: the desktop is a muted blue `░` pattern on a steel-gray field; the
 * default window is blue (white title/border, brightGreen icon accent) and dims
 * to lightGray when inactive; menu and status selections are black/red on green;
 * dialogs use a distinct gray palette (black on lightGray).
 *
 * @example
 * import { defaultTheme, encodeStyle, resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities().profile;
 * const { fg, bg } = defaultTheme.menuBar;
 * const sgr = encodeStyle(fg, bg, 0, caps); // the menu bar's escape sequence
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
  dialog: {
    fg: PALETTE.black,
    bg: PALETTE.lightGray,
    border: PALETTE.white,
    title: PALETTE.white,
    icon: PALETTE.brightGreen,
  },
  button: { fg: PALETTE.black, bg: PALETTE.green },
  buttonFocused: { fg: PALETTE.white, bg: PALETTE.green, hotkey: PALETTE.yellow },
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
  // Focused field intentionally matches the unfocused field; focus shows via the caret, not color.
  inputSelected: { fg: PALETTE.white, bg: PALETTE.blue },
  // The text-selection highlight (distinct from the field color).
  inputSelection: { fg: PALETTE.white, bg: PALETTE.green },
  inputArrows: { fg: PALETTE.brightGreen, bg: PALETTE.blue },
  scrollBarPage: { fg: PALETTE.cyan, bg: PALETTE.blue },
  scrollBarControls: { fg: PALETTE.cyan, bg: PALETTE.blue },
  listNormal: { fg: PALETTE.black, bg: PALETTE.cyan },
  listFocused: { fg: PALETTE.white, bg: PALETTE.green },
  listSelected: { fg: PALETTE.yellow, bg: PALETTE.cyan },
  listDivider: { fg: PALETTE.blue, bg: PALETTE.cyan },
  tableHeader: { fg: PALETTE.white, bg: PALETTE.cyan },
  historyButtonSides: { fg: PALETTE.green, bg: PALETTE.lightGray },
  historyButtonArrow: { fg: PALETTE.black, bg: PALETTE.green },
  historyWindow: { fg: PALETTE.white, bg: PALETTE.blue, border: PALETTE.white, icon: PALETTE.brightGreen },
  historyViewer: { fg: PALETTE.white, bg: PALETTE.blue },
  historyViewerFocused: { fg: PALETTE.white, bg: PALETTE.green },
  outlineNormal: { fg: PALETTE.yellow, bg: PALETTE.blue },
  outlineFocused: { fg: PALETTE.blue, bg: PALETTE.lightGray },
  outlineSelected: { fg: PALETTE.brightGreen, bg: PALETTE.blue },
  outlineNotExpanded: { fg: PALETTE.white, bg: PALETTE.blue },
  tabActive: { fg: PALETTE.white, bg: PALETTE.green, hotkey: PALETTE.yellow },
  tabInactive: { fg: PALETTE.black, bg: PALETTE.green, hotkey: PALETTE.yellow },
  tabDisabled: { fg: PALETTE.darkGray, bg: PALETTE.green },
  progressFill: { fg: PALETTE.brightCyan, bg: PALETTE.blue },
  progressTrack: { fg: PALETTE.cyan, bg: PALETTE.blue },
  sliderTrack: { fg: PALETTE.darkGray, bg: PALETTE.lightGray },
  sliderThumb: { fg: PALETTE.blue, bg: PALETTE.lightGray },
  calendarNormal: { fg: PALETTE.yellow, bg: PALETTE.cyan },
  calendarToday: { fg: PALETTE.blue, bg: PALETTE.green },
  calendarSelected: { fg: PALETTE.white, bg: PALETTE.blue },
  calendarCursor: { fg: PALETTE.black, bg: PALETTE.white },
  calendarDisabled: { fg: PALETTE.darkGray, bg: PALETTE.cyan },
  calendarWeekNumber: { fg: PALETTE.black, bg: PALETTE.cyan },
  colorMarker: { fg: PALETTE.black, bg: PALETTE.lightGray },
  gridCursor: { fg: PALETTE.black, bg: PALETTE.white },
  gridDirty: { fg: PALETTE.brightRed, bg: PALETTE.black },
  fileInfo: { fg: PALETTE.cyan, bg: PALETTE.blue },
  editorNormal: { fg: PALETTE.yellow, bg: PALETTE.blue },
  editorSelected: { fg: PALETTE.blue, bg: PALETTE.lightGray },
  memoNormal: { fg: PALETTE.black, bg: PALETTE.cyan },
  memoSelected: { fg: PALETTE.white, bg: PALETTE.green },
  indicatorNormal: { fg: PALETTE.white, bg: PALETTE.blue },
  indicatorDragging: { fg: PALETTE.brightGreen, bg: PALETTE.blue },
  terminalNormal: { fg: PALETTE.yellow, bg: PALETTE.blue },
  statusBar: { fg: PALETTE.black, bg: PALETTE.lightGray, hotkey: PALETTE.red },
  statusSelected: { fg: PALETTE.black, bg: PALETTE.green, hotkey: PALETTE.red },
  shadow: { fg: PALETTE.darkGray, bg: PALETTE.black },
};
