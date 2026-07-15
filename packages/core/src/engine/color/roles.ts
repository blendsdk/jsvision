/**
 * Expand the 18 semantic aliases into the full set of concrete UI roles.
 *
 * This is the one canonical place that decides which alias colors a generated
 * theme's every control uses. Each of the roles maps to its nearest alias *by
 * purpose* (a focused row and a selected menu item both draw on the accent; body
 * text everywhere shares one foreground), so a coherent theme falls out of a
 * handful of seeds. The hand-authored {@link defaultTheme} keeps its richer
 * per-widget palette and is *not* produced here.
 */
import type { ThemeColors } from './aliases.js';
import type { Theme } from './theme.js';

/**
 * Build a complete {@link Theme} from a resolved 18-token {@link ThemeColors} set.
 *
 * Every one of the theme's roles (and its structural extras — the desktop
 * pattern, window/dialog border/title/icon) is assigned from the alias that best
 * matches its intent, so the result is internally consistent by construction. The
 * return type is `Theme`, so the compiler guarantees no role is forgotten. This
 * is the expansion step inside {@link createTheme}; call it directly only when you
 * already hold a `ThemeColors` object.
 *
 * @param c The 18 resolved semantic aliases.
 * @returns A full theme with every role populated from the aliases.
 * @example
 * import { rolesFromAliases } from '@jsvision/core';
 *
 * const theme = rolesFromAliases({
 *   foreground: '#e0e0e0', foregroundMuted: '#a0a0a0', foregroundDisabled: '#707070',
 *   foregroundOnAccent: '#ffffff', background: '#101010', backgroundRaised: '#202020',
 *   backgroundSunken: '#0a0a0a', backgroundSelected: '#303030', accent: '#3b82f6',
 *   accentMuted: '#2563eb', accelerator: '#f59e0b', menuAccelerator: '#ef4444',
 *   border: '#404040', borderMuted: '#303030', danger: '#ef4444',
 *   warning: '#f59e0b', success: '#22c55e', info: '#0ea5e9',
 * });
 * theme.button.bg; // '#3b82f6' — the accent alias
 */
export function rolesFromAliases(c: ThemeColors): Theme {
  return {
    desktop: { fg: c.foregroundMuted, bg: c.background, pattern: '░' }, // ░
    menuBar: { fg: c.foreground, bg: c.backgroundRaised, hotkey: c.menuAccelerator },
    menuSelected: { fg: c.foregroundOnAccent, bg: c.accent, hotkey: c.menuAccelerator },
    window: { fg: c.foreground, bg: c.backgroundRaised, border: c.border, title: c.foreground, icon: c.accent },
    windowInactive: {
      fg: c.foregroundMuted,
      bg: c.backgroundRaised,
      border: c.borderMuted,
      title: c.foregroundMuted,
      icon: c.foregroundMuted,
    },
    dialog: { fg: c.foreground, bg: c.backgroundRaised, border: c.border, title: c.foreground, icon: c.accent },
    button: { fg: c.foregroundOnAccent, bg: c.accent },
    buttonFocused: { fg: c.foregroundOnAccent, bg: c.accentMuted, hotkey: c.accelerator },
    staticText: { fg: c.foreground, bg: c.backgroundRaised },
    label: { fg: c.foreground, bg: c.backgroundRaised },
    labelSelected: { fg: c.accent, bg: c.backgroundRaised },
    labelShortcut: { fg: c.accelerator, bg: c.backgroundRaised },
    buttonDefault: { fg: c.foregroundOnAccent, bg: c.accent },
    buttonDisabled: { fg: c.foregroundDisabled, bg: c.backgroundRaised },
    buttonShortcut: { fg: c.accelerator, bg: c.accent },
    buttonShadow: { fg: c.foregroundDisabled, bg: c.backgroundRaised },
    clusterNormal: { fg: c.foreground, bg: c.backgroundRaised },
    clusterSelected: { fg: c.accent, bg: c.backgroundRaised },
    clusterShortcut: { fg: c.accelerator, bg: c.backgroundRaised },
    clusterDisabled: { fg: c.foregroundDisabled, bg: c.backgroundRaised },
    inputNormal: { fg: c.foreground, bg: c.backgroundSunken },
    inputSelected: { fg: c.foreground, bg: c.backgroundSunken },
    inputSelection: { fg: c.foregroundOnAccent, bg: c.accent },
    inputArrows: { fg: c.accent, bg: c.backgroundSunken },
    scrollBarPage: { fg: c.foregroundMuted, bg: c.backgroundRaised },
    scrollBarControls: { fg: c.foreground, bg: c.backgroundRaised },
    listNormal: { fg: c.foreground, bg: c.backgroundRaised },
    listFocused: { fg: c.foregroundOnAccent, bg: c.accent },
    listSelected: { fg: c.foreground, bg: c.backgroundSelected },
    listDivider: { fg: c.borderMuted, bg: c.backgroundRaised },
    tableHeader: { fg: c.foregroundOnAccent, bg: c.accent },
    historyButtonSides: { fg: c.accent, bg: c.backgroundRaised },
    historyButtonArrow: { fg: c.foregroundOnAccent, bg: c.accent },
    historyWindow: { fg: c.foreground, bg: c.backgroundRaised, border: c.border, icon: c.accent },
    historyViewer: { fg: c.foreground, bg: c.backgroundRaised },
    historyViewerFocused: { fg: c.foregroundOnAccent, bg: c.accent },
    outlineNormal: { fg: c.foreground, bg: c.backgroundRaised },
    outlineFocused: { fg: c.foregroundOnAccent, bg: c.accent },
    outlineSelected: { fg: c.foreground, bg: c.backgroundSelected },
    outlineNotExpanded: { fg: c.foreground, bg: c.backgroundRaised },
    tabActive: { fg: c.foregroundOnAccent, bg: c.accent, hotkey: c.accelerator },
    tabInactive: { fg: c.foregroundOnAccent, bg: c.accentMuted, hotkey: c.accelerator },
    tabDisabled: { fg: c.foregroundDisabled, bg: c.accentMuted },
    progressFill: { fg: c.foregroundOnAccent, bg: c.accent },
    progressTrack: { fg: c.foregroundMuted, bg: c.backgroundSunken },
    sliderTrack: { fg: c.borderMuted, bg: c.backgroundRaised },
    sliderThumb: { fg: c.accent, bg: c.backgroundRaised },
    calendarNormal: { fg: c.foreground, bg: c.backgroundRaised },
    calendarToday: { fg: c.foregroundOnAccent, bg: c.accent },
    calendarSelected: { fg: c.foregroundOnAccent, bg: c.accent },
    calendarCursor: { fg: c.foregroundOnAccent, bg: c.accentMuted },
    calendarDisabled: { fg: c.foregroundDisabled, bg: c.backgroundRaised },
    calendarWeekNumber: { fg: c.foregroundMuted, bg: c.backgroundRaised },
    colorMarker: { fg: c.foreground, bg: c.backgroundRaised },
    fileInfo: { fg: c.foregroundMuted, bg: c.backgroundRaised },
    editorNormal: { fg: c.foreground, bg: c.backgroundSunken },
    editorSelected: { fg: c.foregroundOnAccent, bg: c.accent },
    memoNormal: { fg: c.foreground, bg: c.backgroundSunken },
    memoSelected: { fg: c.foregroundOnAccent, bg: c.accent },
    indicatorNormal: { fg: c.foregroundMuted, bg: c.backgroundRaised },
    indicatorDragging: { fg: c.success, bg: c.backgroundRaised },
    terminalNormal: { fg: c.foreground, bg: c.backgroundSunken },
    statusBar: { fg: c.foreground, bg: c.backgroundRaised, hotkey: c.menuAccelerator },
    statusSelected: { fg: c.foregroundOnAccent, bg: c.accent, hotkey: c.menuAccelerator },
    shadow: { fg: c.foregroundDisabled, bg: c.background },
    dangerText: { fg: c.danger, bg: c.backgroundRaised },
    warningText: { fg: c.warning, bg: c.backgroundRaised },
  };
}
