/**
 * `StatusLine` — the static bottom command row (RD-05 AR-72/AR-77).
 *
 * A static, left-packed row of command-bound items. Each item draws its label with the `~hotkey~`
 * char accented; a click in the item's hit-zone, or a press of its `key` accelerator (e.g. `Alt+X`),
 * emits the item's command via the loop seam; a disabled command greys + is non-activatable. The row
 * is **post-process** so an accelerator fires only when the focused view did not consume the key
 * (AR-51). The item list is static — help-context ranges are out of scope (AR-72).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Style, KeyEvent } from '@jsvision/core';
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { parseTilde, tildeSegments } from '../menu/index.js';

/** A status-line entry: a tilde-marked label, the command it emits, and an optional `key` accelerator. */
export interface StatusItem {
  /** Display label; `~X~` marks the accent char (AR-77). */
  text: string;
  /** The command emitted on click / accelerator. */
  command: string;
  /** Optional accelerator label, e.g. `'Alt+X'` / `'Ctrl+Q'` / `'F1'` (matched in `onEvent`). */
  key?: string;
}

/** The loop seam the status line needs for activation + greying (PA-7). */
export interface StatusLoopSeam {
  /** Raise the item's command onto the dispatch tick (AR-52). */
  emitCommand(command: string, arg?: unknown): void;
  /** Whether a command is enabled — drives greying + non-activatability (AR-72). */
  isCommandEnabled(command: string): boolean;
}

/**
 * A laid-out item, exactly as Turbo Vision's `TStatusLine` packs them (`tstatusl.cpp`): a leading pad
 * space at {@link x}, the display text at {@link textX} = `x+1`, a trailing pad space, then the next
 * item abuts. The full ` text ` span (pads included) is both the colored region and the [x, x+width)
 * hit-zone (`drawSelect` colors the pads; `itemMouseIsIn` spans `[i, i+len+2)`).
 */
interface ItemBox {
  item: StatusItem;
  /** The item's leading-pad column (the start of its colored span + hit-zone). */
  x: number;
  /** The display-text column (`x + 1`, one past the leading pad). */
  textX: number;
  /** The full span width: leading pad + text + trailing pad (`len + 2`). */
  width: number;
  text: string;
}

/**
 * Match an accelerator label (e.g. `'Alt+X'`, `'Ctrl+Q'`, `'F1'`) against a decoded key event.
 * Modifier tokens (`Alt`/`Ctrl`/`Control`/`Shift`, case-insensitive) precede the key token; the key
 * token compares case-insensitively against `ev.key`.
 *
 * @param label The accelerator label.
 * @param ev    The decoded key event.
 * @returns Whether the chord matches.
 */
function matchesChord(label: string, ev: KeyEvent): boolean {
  const parts = label.split('+').map((part) => part.trim().toLowerCase());
  const keyToken = parts[parts.length - 1] ?? '';
  const mods = parts.slice(0, -1);
  const wantAlt = mods.includes('alt');
  const wantCtrl = mods.includes('ctrl') || mods.includes('control');
  const wantShift = mods.includes('shift');
  if (ev.alt !== wantAlt || ev.ctrl !== wantCtrl || ev.shift !== wantShift) return false;
  return ev.key.toLowerCase() === keyToken;
}

/** The application status line: a static command-bound bottom row (AR-72). */
export class StatusLine extends View {
  /** The status entries (set by the {@link statusLine} builder). */
  items: readonly StatusItem[] = [];
  /** The loop seam; `null` until {@link attach} wires it (PA-7). */
  seam: StatusLoopSeam | null = null;

  constructor() {
    super();
    this.postProcess = true; // accelerators fire only if the focused view didn't consume the key (AR-51)
  }

  /**
   * @internal Wire the loop seam (called once by `createApplication`, PA-7).
   *
   * @param seam The loop seam (`emitCommand`/`isCommandEnabled`).
   */
  attach(seam: StatusLoopSeam): void {
    this.seam = seam;
  }

  /** Lay the items left-to-right as ` text ` spans (TV `i += len+2`); each span is its hit-zone. */
  private itemBoxes(): ItemBox[] {
    const boxes: ItemBox[] = [];
    let x = 0; // TV draws the first item's leading pad at column 0
    for (const item of this.items) {
      const text = parseTilde(item.text).text;
      const width = text.length + 2; // leading + trailing pad space
      boxes.push({ item, x, textX: x + 1, width, text });
      x += width;
    }
    return boxes;
  }

  /** Draw the row background then each item, accenting its `~hotkey~` char; disabled items grey (AR-72). */
  draw(ctx: DrawContext): void {
    const role = ctx.role('statusBar');
    const base = ctx.color('statusBar');
    // TV's hotkey attribute `0x74` is plain red on the bar bg — no intensity bit.
    const accent: Style = { fg: role.hotkey ?? base.fg, bg: base.bg };
    const dim: Style = { fg: ctx.role('shadow').fg, bg: base.bg };

    ctx.fillRect(0, 0, ctx.size.width, 1, ' ', base);
    for (const box of this.itemBoxes()) {
      const enabled = this.seam === null || this.seam.isCommandEnabled(box.item.command);
      const style = enabled ? base : dim;
      // Color the item's full span — both pad spaces included — exactly as TV's `drawSelect`.
      ctx.fillRect(box.x, 0, box.width, 1, ' ', style);
      // Render each `~…~` run: the highlighted accelerator run(s) in red, the rest normal — TV's
      // `moveCStr` toggles the attribute at every tilde, so a multi-char run like `~Alt-X~` is all red.
      for (const seg of tildeSegments(box.item.text)) {
        ctx.text(box.textX + seg.col, 0, seg.text, enabled && seg.hot ? accent : style);
      }
    }
  }

  /**
   * Emit a command on a click in an item's hit-zone, or on a press of an item's accelerator (AR-72).
   * A disabled command is non-activatable.
   *
   * @param ev The dispatch envelope; `ev.handled = true` consumes the event.
   */
  override onEvent(ev: DispatchEvent): void {
    const seam = this.seam;
    if (seam === null) return;
    const inner = ev.event;

    if (inner.type === 'mouse') {
      if (inner.kind === 'down' && ev.local !== undefined) {
        const box = this.itemBoxes().find((b) => ev.local!.x >= b.x && ev.local!.x < b.x + b.width);
        if (box !== undefined && seam.isCommandEnabled(box.item.command)) {
          seam.emitCommand(box.item.command);
          ev.handled = true;
        }
      }
      return;
    }
    if (inner.type !== 'key') return;

    for (const item of this.items) {
      if (item.key !== undefined && matchesChord(item.key, inner) && seam.isCommandEnabled(item.command)) {
        seam.emitCommand(item.command);
        ev.handled = true;
        return;
      }
    }
  }
}

/**
 * Build a {@link StatusLine} from an item list (AR-72). The builder only assembles data; the loop
 * seam is wired later by `createApplication` via {@link StatusLine.attach}.
 *
 * @param items The status entries (left-packed in order).
 * @returns A constructed `StatusLine`.
 */
export function statusLine(items: StatusItem[]): StatusLine {
  const line = new StatusLine();
  line.items = items;
  return line;
}

/**
 * Build a {@link StatusItem} (AR-72/AR-77).
 *
 * @param text    The display label; `~X~` marks the accent char.
 * @param command The command emitted on click / accelerator.
 * @param key     Optional accelerator label, e.g. `'Alt+X'`.
 * @returns A status entry.
 */
export function statusItem(text: string, command: string, key?: string): StatusItem {
  return key === undefined ? { text, command } : { text, command, key };
}
