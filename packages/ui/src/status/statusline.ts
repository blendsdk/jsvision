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

/** The loop seam the status line needs for activation + greying + press tracking (PA-7 / RD-10 PA-1). */
export interface StatusLoopSeam {
  /** Raise the item's command onto the dispatch tick (AR-52). */
  emitCommand(command: string, arg?: unknown): void;
  /** Whether a command is enabled — drives greying + non-activatability (AR-72). */
  isCommandEnabled(command: string): boolean;
  /** Capture the pointer to the status line for the duration of a press (RD-10 AR-82/AR-88). */
  setCapture(view: View): void;
  /** Release the pointer capture (RD-10). */
  releaseCapture(): void;
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
  /** @internal The item currently under the cursor while a press is held (drawn `statusSelected`); `null` = none. */
  protected pressed: StatusItem | null = null;
  /** @internal Whether a mouse press is in flight (captured); gates drag re-target + release-emit (RD-10 AR-88). */
  protected holding = false;

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

  /** The item box whose [x, x+width) hit-zone contains the row-local `x`, or `null`. */
  private itemAt(x: number): ItemBox | null {
    return this.itemBoxes().find((b) => x >= b.x && x < b.x + b.width) ?? null;
  }

  /**
   * Draw the row background then each item (AR-72). A held item (`pressed`) paints in `statusSelected`
   * (black on green, red-on-green hotkey) — TV's `cSelect`; a held disabled item in `cSelDisabled`
   * (darkGray on green). Otherwise normal (black/red on lightGray) or greyed (disabled). The `~…~`
   * accelerator run(s) take the accent color, matching TV's `moveCStr` toggle.
   */
  draw(ctx: DrawContext): void {
    const base = ctx.color('statusBar');
    const selected = ctx.color('statusSelected');
    const dimFg = ctx.role('shadow').fg; // darkGray — TV cNormDisabled/cSelDisabled fg (0x78/0x28)
    // TV's hotkey attribute is plain red on the row bg — no intensity bit.
    const accent: Style = { fg: ctx.role('statusBar').hotkey ?? base.fg, bg: base.bg };
    const selAccent: Style = { fg: ctx.role('statusSelected').hotkey ?? selected.fg, bg: selected.bg };
    const dim: Style = { fg: dimFg, bg: base.bg };
    const selDim: Style = { fg: dimFg, bg: selected.bg }; // cSelDisabled — darkGray on green

    ctx.fillRect(0, 0, ctx.size.width, 1, ' ', base);
    for (const box of this.itemBoxes()) {
      const enabled = this.seam === null || this.seam.isCommandEnabled(box.item.command);
      const isPressed = this.pressed === box.item;
      const style = isPressed ? (enabled ? selected : selDim) : enabled ? base : dim;
      const hotStyle = isPressed ? selAccent : accent;
      // Color the item's full span — both pad spaces included — exactly as TV's `drawSelect`.
      ctx.fillRect(box.x, 0, box.width, 1, ' ', style);
      // Render each `~…~` run: the highlighted accelerator run(s) in the accent color, the rest normal.
      for (const seg of tildeSegments(box.item.text)) {
        ctx.text(box.textX + seg.col, 0, seg.text, enabled && seg.hot ? hotStyle : style);
      }
    }
  }

  /**
   * Handle a mouse press/drag/release on the bar, or an item-accelerator key (AR-72, RD-10 AR-88).
   * Mouse: a press captures the pointer and highlights the item under the cursor (no emit); a captured
   * drag re-targets the highlight to the item under the cursor; a release frees the capture and emits
   * the command of the item **under the release point** if enabled (TV `tstatusl.cpp` `handleEvent`,
   * PA-10 — release off all items / on a disabled item emits nothing). A disabled command is
   * non-activatable; accelerators still emit directly.
   *
   * @param ev The dispatch envelope; `ev.handled = true` consumes the event.
   */
  override onEvent(ev: DispatchEvent): void {
    const seam = this.seam;
    if (seam === null) return;
    const inner = ev.event;

    if (inner.type === 'mouse') {
      if (ev.local === undefined) return;
      if (inner.kind === 'down') {
        // Capture on any press in the bar (TV tracks from the press, wherever it lands).
        this.holding = true;
        this.pressed = this.itemAt(ev.local.x)?.item ?? null;
        seam.setCapture(this);
        this.invalidate();
        ev.handled = true;
      } else if ((inner.kind === 'move' || inner.kind === 'drag') && this.holding) {
        // HR-14 (PA-13): abandon the press tracking if the capture was lost externally (a modal
        // opened mid-press) — otherwise a later move re-highlights from stale `holding` state.
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
        const box = this.itemAt(ev.local.x); // the item under the RELEASE point (PA-10)
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
