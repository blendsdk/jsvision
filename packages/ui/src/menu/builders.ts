/**
 * Menu data builders and the tilde-hotkey convention.
 *
 * A menu is plain data: `subMenu`/`item`/`separator` produce {@link MenuItem} nodes that a
 * {@link MenuBar} and its popups render. In a label, `~X~` marks the accelerator character — `X` is
 * shown underlined and pressing `Alt+X` (on the bar) or plain `X` (in an open menu) triggers the item.
 * `parseTilde` strips the tildes and reports the hotkey char plus its display column; `layoutTitles`
 * places the top-level titles left-to-right.
 */
import { Attr } from '@jsvision/core';
import type { Style } from '@jsvision/core';
import { reportDuplicateAccelerators } from './accelerators.js';

/**
 * Emphasize an accelerator (`~X~`) glyph's style while the accelerator overlay is being revealed.
 * When `reveal` is set, adds bold + underline to the base style (no colour or width change);
 * otherwise returns the base unchanged. Bold and underline together are used because underline alone
 * reads too faintly on many terminals. Every `~X~` drawer calls this so the emphasis is identical
 * everywhere, and applies it only to an **enabled** accelerator so a greyed one never lights up.
 *
 * @param base   The accelerator run's base style.
 * @param reveal Whether the accelerator overlay is currently revealed (from `DrawContext.revealAccelerators`).
 * @returns The base style, bold + underlined while `reveal` is set.
 */
export function accentStyle(base: Style, reveal: boolean): Style {
  return reveal ? { ...base, attrs: (base.attrs ?? Attr.none) | Attr.bold | Attr.underline } : base;
}

/** A node in the menu tree (plain data). */
export type MenuItem =
  | { kind: 'item'; title: string; command: string; key?: string } // `~X~` in the title marks the hotkey
  | { kind: 'sub'; title: string; items: MenuItem[] }
  | { kind: 'separator' };

/** A label with its `~X~` accelerator parsed out. */
export interface ParsedLabel {
  /** The display text (tildes removed). */
  text: string;
  /** The lowercase accelerator char, or `null` if the label had no `~X~`. */
  hotkey: string | null;
  /** The accelerator char's column in {@link text}, or `-1` when there is none. */
  hotkeyCol: number;
}

/** A run of label text sharing one color: the highlighted (`hot`) accelerator run, or normal text. */
export interface TildeSegment {
  /** The run's display text (no tildes). */
  text: string;
  /** Whether the run is the highlighted accelerator (drawn in the hotkey color). */
  hot: boolean;
  /** The run's starting column in the full display text. */
  col: number;
}

/** A top-level title's placement on the menu bar. */
export interface TitleLayout {
  index: number;
  /** The button's left column (the leading pad space). */
  x: number;
  /** The full ` text ` button width — display text + one pad column on each side. */
  width: number;
  label: ParsedLabel;
}

/** Leading blank column before the first bar button (drawing starts at column 1). */
const TITLE_MARGIN = 1;
/** Pad columns around each bar title — one space on each side, so a title renders as ` text `. */
const TITLE_PAD = 2;

/**
 * Parse a `~X~` accelerator out of a label. The char between the first matching tilde pair is the
 * accelerator; the tildes are removed from the display text.
 *
 * @param label A label, optionally containing one `~X~` accelerator marker.
 * @returns The display text, the lowercase hotkey char (or `null`), and its column.
 */
export function parseTilde(label: string): ParsedLabel {
  const open = label.indexOf('~');
  if (open === -1 || open + 2 >= label.length || label[open + 2] !== '~') {
    return { text: label.replace(/~/g, ''), hotkey: null, hotkeyCol: -1 };
  }
  const hotChar = label[open + 1];
  const text = label.slice(0, open) + hotChar + label.slice(open + 3);
  return { text, hotkey: hotChar.toLowerCase(), hotkeyCol: open };
}

/**
 * Split a label into colour runs at every `~`: each `~` toggles between normal and highlighted
 * (accelerator) text, and the tildes are removed. Unlike {@link parseTilde}, this supports
 * **multi-character** highlighted runs — e.g. `'~Alt-X~ Exit'` yields "Alt-X" highlighted and " Exit"
 * normal — which is the form the status line uses.
 *
 * @param label A label with zero or more `~…~` highlighted runs.
 * @returns The non-empty runs in order, each tagged `hot` and carrying its starting display column.
 */
export function tildeSegments(label: string): TildeSegment[] {
  const segments: TildeSegment[] = [];
  let hot = false;
  let col = 0;
  let current = '';
  let startCol = 0;
  const flush = (): void => {
    if (current.length > 0) {
      segments.push({ text: current, hot, col: startCol });
      current = '';
    }
  };
  for (const ch of label) {
    if (ch === '~') {
      flush();
      hot = !hot;
      continue;
    }
    if (current.length === 0) startCol = col;
    current += ch;
    col += 1;
  }
  flush();
  return segments;
}

/** The title text of a top-level menu node (`''` for a separator, which is never a top-level title). */
function titleOf(node: MenuItem): string {
  return node.kind === 'separator' ? '' : node.title;
}

/** A menu node's `~X~` accelerator char (lowercase), or `''` when it has none (separators, no `~X~`). */
export function menuItemHotkey(node: MenuItem): string {
  return node.kind === 'separator' ? '' : (parseTilde(node.title).hotkey ?? '');
}

/** A menu node's display label (tildes stripped), or `''` for a separator — used to name a collision. */
export function menuItemLabel(node: MenuItem): string {
  return node.kind === 'separator' ? '' : parseTilde(node.title).text;
}

/**
 * Place the top-level titles left-to-right as abutting ` text ` buttons: the first starts at column
 * 1, each spans its display text plus one pad space on each side, and the next begins where the
 * previous ended (the pad spaces form the visible gap).
 *
 * @param tops The top-level menu nodes.
 * @returns Each title's index, button left x, full button width, and parsed label.
 */
export function layoutTitles(tops: readonly MenuItem[]): TitleLayout[] {
  const out: TitleLayout[] = [];
  let x = TITLE_MARGIN;
  tops.forEach((node, index) => {
    const label = parseTilde(titleOf(node));
    const width = label.text.length + TITLE_PAD;
    out.push({ index, x, width, label });
    x += width;
  });
  return out;
}

/** The top-level title index whose x-range contains `x`, or `null`. */
export function titleIndexAt(tops: readonly MenuItem[], x: number): number | null {
  for (const t of layoutTitles(tops)) {
    if (x >= t.x && x < t.x + t.width) return t.index;
  }
  return null;
}

/**
 * Build a submenu node — a titled entry that opens a nested list of items (or further submenus). Use
 * these as the top-level entries passed to {@link menuBar}.
 *
 * @param title The submenu label; `~X~` marks its accelerator character.
 * @param items The child items shown when it opens.
 * @returns A submenu {@link MenuItem} node.
 * @example
 * import { menuBar, subMenu, item, separator, Commands } from '@jsvision/ui';
 *
 * const bar = menuBar([
 *   subMenu('~F~ile', [
 *     item('~N~ew', 'file.new'),
 *     separator(),
 *     item('E~x~it', Commands.quit, 'Alt+X'),
 *   ]),
 * ]);
 */
export function subMenu(title: string, items: MenuItem[]): MenuItem {
  // Dev-only: flag two items in this submenu that claim the same `~X~` accelerator (only the first is
  // reachable). Nested submenus are built innermost-first, so each level is checked exactly once.
  reportDuplicateAccelerators('menu', items.map(menuItemHotkey), items.map(menuItemLabel));
  return { kind: 'sub', title, items };
}

/**
 * Build a command item — a selectable row that emits `command` when chosen. Handle the command from
 * the status line, the app, or a `Dialog`.
 *
 * @param title   The item label; `~X~` marks its accelerator character.
 * @param command The command name emitted when the item is chosen.
 * @param key     Optional accelerator label shown right-aligned, e.g. `'Alt+X'` or `'Ctrl+S'`.
 * @returns A command {@link MenuItem} node.
 * @example
 * import { item, Commands } from '@jsvision/ui';
 *
 * const tile = item('~T~ile', Commands.tile, 'F4');
 */
export function item(title: string, command: string, key?: string): MenuItem {
  return { kind: 'item', title, command, key };
}

/**
 * Build a separator — a horizontal rule between groups of items inside a submenu.
 *
 * @returns A separator {@link MenuItem} node.
 * @example
 * import { subMenu, item, separator } from '@jsvision/ui';
 *
 * const file = subMenu('~F~ile', [item('~O~pen', 'file.open'), separator(), item('E~x~it', 'quit')]);
 */
export function separator(): MenuItem {
  return { kind: 'separator' };
}
