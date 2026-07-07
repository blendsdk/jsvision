/**
 * The application status line: the bottom row of command shortcuts.
 *
 * It shows a left-packed row of items, each a label with its `~hotkey~` character accented. Clicking
 * an item, or pressing its accelerator key (e.g. `Alt+X` or `F4`), emits that item's command; a
 * disabled command is greyed and does nothing. Accelerators fire only when the focused view did not
 * already consume the key, so a status shortcut never overrides a control's own key handling.
 *
 * You normally build one with {@link statusLine} and pass it to `createApplication({ statusLine })`.
 */
import type { Style, KeyEvent } from '@jsvision/core';
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { parseTilde, tildeSegments, accentStyle } from '../menu/index.js';

/** A status-line entry: a tilde-marked label, the command it emits, and an optional accelerator key. */
export interface StatusItem {
  /** Display label; `~X~` marks the accent character. */
  text: string;
  /** The command emitted when the item is clicked or its accelerator is pressed. */
  command: string;
  /** Optional accelerator label, e.g. `'Alt+X'`, `'Ctrl+Q'`, or `'F1'`. */
  key?: string;
}

/** The application operations the status line calls into for activation, greying, and press capture. */
export interface StatusLoopSeam {
  /** Emit the item's command so the app can handle it. */
  emitCommand(command: string, arg?: unknown): void;
  /** Whether a command is enabled — a disabled item is greyed and cannot be activated. */
  isCommandEnabled(command: string): boolean;
  /** Capture the pointer to the status line for the duration of a press. */
  setCapture(view: View): void;
  /** Release the pointer capture. */
  releaseCapture(): void;
}

/**
 * A laid-out item: a leading pad space at {@link x}, the display text at {@link textX} (`x + 1`), a
 * trailing pad space, then the next item abuts. The full ` text ` span (pads included) is both the
 * coloured region and the `[x, x + width)` hit-zone.
 */
interface ItemBox {
  item: StatusItem;
  /** The item's leading-pad column (the start of its coloured span and hit-zone). */
  x: number;
  /** The display-text column (`x + 1`, one past the leading pad). */
  textX: number;
  /** The full span width: leading pad + text + trailing pad. */
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

/**
 * The application status line. Build one with {@link statusLine} and give it to the application.
 *
 * @example
 * import { createApplication, statusLine, statusItem, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const app = createApplication({
 *   caps: resolveCapabilities().profile,
 *   statusLine: statusLine([
 *     statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
 *     statusItem('~F4~ Tile', Commands.tile, 'F4'),
 *     statusItem('~F5~ Cascade', Commands.cascade, 'F5'),
 *   ]),
 * });
 * // Click "Exit", or press Alt+X, to emit the quit command.
 */
export class StatusLine extends View {
  /** The status entries (usually set for you by the {@link statusLine} builder). */
  items: readonly StatusItem[] = [];
  /** The loop seam; `null` until the application wires it in via {@link attach}. */
  seam: StatusLoopSeam | null = null;
  /** @internal The item under the cursor while a press is held (drawn selected); `null` = none. */
  protected pressed: StatusItem | null = null;
  /** @internal Whether a mouse press is currently held (captured); gates drag re-target and release-emit. */
  protected holding = false;

  constructor() {
    super();
    this.postProcess = true; // an accelerator fires only if the focused view didn't consume the key
  }

  /**
   * @internal Wire the loop seam. Called once by `createApplication`.
   *
   * @param seam The application operations (`emitCommand`/`isCommandEnabled`/capture).
   */
  attach(seam: StatusLoopSeam): void {
    this.seam = seam;
  }

  /** Lay the items left-to-right as ` text ` spans; each span is that item's hit-zone. */
  private itemBoxes(): ItemBox[] {
    const boxes: ItemBox[] = [];
    let x = 0; // the first item's leading pad sits at column 0
    for (const item of this.items) {
      const text = parseTilde(item.text).text;
      const width = text.length + 2; // leading + trailing pad space
      boxes.push({ item, x, textX: x + 1, width, text });
      x += width;
    }
    return boxes;
  }

  /** The item box whose [x, x+width) hit-zone contains the row-local `x`, or `null`. */
  private itemAt(x: number): ItemBox | null {
    return this.itemBoxes().find((b) => x >= b.x && x < b.x + b.width) ?? null;
  }

  /**
   * Draw the row background then each item. A held item is drawn selected; a held disabled item is
   * greyed on the selected background. Otherwise items are drawn normally, or greyed if disabled. The
   * `~…~` accelerator run(s) take the accent colour.
   */
  draw(ctx: DrawContext): void {
    const base = ctx.color('statusBar');
    const selected = ctx.color('statusSelected');
    const dimFg = ctx.role('shadow').fg; // darkGray — the greyed foreground for disabled items
    // The accelerator accent also picks up an underline while the accelerator overlay is revealed;
    // the loop below applies it only to an enabled item's accelerator run, so a greyed one never
    // lights up.
    const accent: Style = accentStyle(
      { fg: ctx.role('statusBar').hotkey ?? base.fg, bg: base.bg },
      ctx.revealAccelerators,
    );
    const selAccent: Style = accentStyle(
      { fg: ctx.role('statusSelected').hotkey ?? selected.fg, bg: selected.bg },
      ctx.revealAccelerators,
    );
    const dim: Style = { fg: dimFg, bg: base.bg };
    const selDim: Style = { fg: dimFg, bg: selected.bg }; // greyed on the selected bg

    ctx.fillRect(0, 0, ctx.size.width, 1, ' ', base);
    for (const box of this.itemBoxes()) {
      const enabled = this.seam === null || this.seam.isCommandEnabled(box.item.command);
      const isPressed = this.pressed === box.item;
      const style = isPressed ? (enabled ? selected : selDim) : enabled ? base : dim;
      const hotStyle = isPressed ? selAccent : accent;
      // Colour the item's full span, both pad spaces included.
      ctx.fillRect(box.x, 0, box.width, 1, ' ', style);
      // Draw each `~…~` run: the accelerator run(s) in the accent colour, the rest in the row colour.
      for (const seg of tildeSegments(box.item.text)) {
        ctx.text(box.textX + seg.col, 0, seg.text, enabled && seg.hot ? hotStyle : style);
      }
    }
  }

  /**
   * Handle a mouse press/drag/release on the bar, or an item accelerator key. A press captures the
   * pointer and highlights the item under the cursor (nothing is emitted yet); dragging re-targets
   * the highlight to the item under the cursor; releasing frees the capture and emits the command of
   * the item **under the release point**, if enabled — so releasing off every item, or on a disabled
   * one, emits nothing. A disabled command cannot be activated; accelerator keys emit directly.
   *
   * @param ev The dispatch envelope; setting `ev.handled = true` consumes the event.
   */
  override onEvent(ev: DispatchEvent): void {
    const seam = this.seam;
    if (seam === null) return;
    const inner = ev.event;

    if (inner.type === 'mouse') {
      if (ev.local === undefined) return;
      if (inner.kind === 'down') {
        // Capture on any press in the bar, wherever it lands.
        this.holding = true;
        this.pressed = this.itemAt(ev.local.x)?.item ?? null;
        seam.setCapture(this);
        this.invalidate();
        ev.handled = true;
      } else if ((inner.kind === 'move' || inner.kind === 'drag') && this.holding) {
        // Abandon the press if the capture was taken away (e.g. a modal opened mid-press), so a later
        // move does not re-highlight from stale press state.
        if (ev.hasCapture !== undefined && !ev.hasCapture(this)) {
          this.holding = false;
          this.pressed = null;
          this.invalidate();
          return;
        }
        const next = this.itemAt(ev.local.x)?.item ?? null;
        if (next !== this.pressed) {
          this.pressed = next;
          this.invalidate();
        }
        ev.handled = true;
      } else if (inner.kind === 'up' && this.holding) {
        this.holding = false;
        seam.releaseCapture();
        const box = this.itemAt(ev.local.x); // the item under the release point
        this.pressed = null;
        this.invalidate();
        if (box !== null && seam.isCommandEnabled(box.item.command)) seam.emitCommand(box.item.command);
        ev.handled = true;
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
 * Build a {@link StatusLine} from a list of items. This only assembles the data; the application
 * wires up behaviour when you pass the line to `createApplication`.
 *
 * @param items The status entries, left-packed in order.
 * @returns A constructed `StatusLine`.
 * @example
 * import { createApplication, statusLine, statusItem, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const status = statusLine([
 *   statusItem('~T~ile', Commands.tile, 'F4'),
 *   statusItem('~Q~uit', Commands.quit, 'Alt+X'),
 * ]);
 * const app = createApplication({ caps: resolveCapabilities().profile, statusLine: status });
 */
export function statusLine(items: StatusItem[]): StatusLine {
  const line = new StatusLine();
  line.items = items;
  return line;
}

/**
 * Build a single {@link StatusItem} for a {@link statusLine}.
 *
 * @param text    The display label; `~X~` marks the accent character.
 * @param command The command emitted when the item is clicked or its accelerator is pressed.
 * @param key     Optional accelerator label, e.g. `'Alt+X'` or `'F4'`.
 * @returns A status entry.
 * @example
 * import { statusItem, Commands } from '@jsvision/ui';
 *
 * const exit = statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X');
 */
export function statusItem(text: string, command: string, key?: string): StatusItem {
  return key === undefined ? { text, command } : { text, command, key };
}
