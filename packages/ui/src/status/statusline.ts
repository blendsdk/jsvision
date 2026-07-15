/**
 * The application status line: the bottom row of the app shell.
 *
 * It is a general row container — its children are views: interactive command shortcuts
 * ({@link StatusItemView}), a flexible `spacer()` for right-alignment or hard gaps, and any fitting
 * 1-row passive widget (a `ProgressBar`, a `Spinner`, a live `Text`). Clicking a command item, or
 * pressing its accelerator (e.g. `Alt+X` or `F4`), emits that item's command; a disabled command is
 * greyed and does nothing. Accelerators fire only when the focused view did not already consume the
 * key, so a status shortcut never overrides a control's own key handling.
 *
 * The status line remains the single interaction owner: it drives press capture, drag re-target,
 * emit-on-release, and the accelerator sweep across its command items; passive segments (spacers,
 * widgets, command-less labels) are skipped by hit-testing and accelerators.
 *
 * You normally build one with {@link statusLine} and pass it to `createApplication({ statusLine })`.
 */
import type { KeyEvent } from '@jsvision/core';
import { Group } from '../view/index.js';
import type { DispatchEvent, View } from '../view/index.js';
import { StatusItemView } from './status-item.js';

/** The application operations the status line calls into for activation, greying, and press capture. */
export interface StatusLoopSeam {
  /** Emit the item's command so the app can handle it. */
  emitCommand(command: string, arg?: unknown): void;
  /** Whether a command is enabled — a disabled item is greyed and cannot be activated. */
  isCommandEnabled(command: string): boolean;
  /** A tick that changes on any command-enablement change; the bar binds it so greying repaints live. */
  commandsVersion(): number;
  /** Capture the pointer to the status line for the duration of a press. */
  setCapture(view: Group): void;
  /** Release the pointer capture. */
  releaseCapture(): void;
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
 * import { createApplication, statusLine, statusItem, spacer, Commands } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const app = createApplication({
 *   caps: resolveCapabilities().profile,
 *   statusLine: statusLine([
 *     statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
 *     spacer(),                                   // push the rest to the right edge
 *     statusItem('~F4~ Tile', Commands.tile, 'F4'),
 *   ]),
 * });
 * // Click "Exit", or press Alt+X, to emit the quit command.
 */
export class StatusLine extends Group {
  /** The loop seam; `null` until the application wires it in via {@link attach}. */
  seam: StatusLoopSeam | null = null;
  /** @internal The command item under the cursor while a press is held (drawn selected); `null` = none. */
  private pressed: StatusItemView | null = null;
  /** @internal Whether a mouse press is currently held (captured); gates drag re-target and release-emit. */
  private holding = false;

  constructor() {
    super();
    this.layout = { direction: 'row' }; // items laid out left-to-right; `spacer()` absorbs the slack
    this.background = 'statusBar'; // fill the whole row, so gap + trailing cells stay status-coloured
    this.postProcess = true; // an accelerator fires only if the focused view didn't consume the key
  }

  /**
   * @internal Wire the loop seam and push the live enabled-state resolver to each command item so a
   * disabled command greys as its enablement changes. Called once by `createApplication`. Also binds
   * the seam's command-version tick so any `enableCommand` repaints the bar (and thus re-greys its
   * items) live — greying is otherwise inert because a view's `draw()` runs untracked.
   *
   * @param seam The application operations (`emitCommand`/`isCommandEnabled`/`commandsVersion`/capture).
   */
  attach(seam: StatusLoopSeam): void {
    this.seam = seam;
    this.wireEnablement();
    // `attach` runs after the bar is mounted, so `onMount` fires the bind immediately; binding here
    // (not in the constructor) is what subscribes the bar to the version tick within its own scope.
    this.onMount(() => this.bind(() => seam.commandsVersion()));
  }

  /**
   * Replace the bar's items in place and re-wire enablement, so a router can swap a screen's status
   * contribution onto the shared bar. Activation already flows through this line, so the new items
   * emit correctly with no further wiring.
   *
   * @param items The status items/spacers to show; replaces the current children.
   */
  setItems(items: View[]): void {
    for (const child of [...this.children]) this.remove(child);
    for (const item of items) this.add(item);
    this.wireEnablement();
  }

  /** Push the live enabled-state resolver into each command item (from the wired seam). */
  private wireEnablement(): void {
    const seam = this.seam;
    if (seam === null) return;
    for (const item of this.commandItems()) {
      item.isEnabled = (command): boolean => seam.isCommandEnabled(command);
    }
  }

  /** The command-bearing item children; passive segments (spacers, widgets, command-less labels) are skipped. */
  private commandItems(): StatusItemView[] {
    return this.children.filter(
      (child): child is StatusItemView => child instanceof StatusItemView && child.command !== undefined,
    );
  }

  /** The command item whose laid-out `[bounds.x, bounds.x + width)` contains the row-local `x`, or `null`. */
  private itemAt(x: number): StatusItemView | null {
    return this.commandItems().find((item) => x >= item.bounds.x && x < item.bounds.x + item.bounds.width) ?? null;
  }

  /** Move the held-press highlight to `next` (or clear it), repainting only the items whose state flips. */
  private setPressed(next: StatusItemView | null): void {
    if (next === this.pressed) return;
    if (this.pressed !== null) {
      this.pressed.pressed = false;
      this.pressed.invalidate();
    }
    this.pressed = next;
    if (next !== null) {
      next.pressed = true;
      next.invalidate();
    }
  }

  /**
   * Handle a mouse press/drag/release on the bar, or an item accelerator key. A press captures the
   * pointer and highlights the command item under the cursor (nothing is emitted yet); dragging
   * re-targets the highlight to the item under the cursor; releasing frees the capture and emits the
   * command of the item **under the release point**, if enabled — so releasing off every item, over a
   * passive segment, or on a disabled one emits nothing. Accelerator keys emit directly.
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
        this.holding = true;
        this.setPressed(this.itemAt(ev.local.x));
        seam.setCapture(this);
        ev.handled = true;
      } else if ((inner.kind === 'move' || inner.kind === 'drag') && this.holding) {
        // Abandon the press if the capture was taken away (e.g. a modal opened mid-press), so a later
        // move does not re-highlight from stale press state.
        if (ev.hasCapture !== undefined && !ev.hasCapture(this)) {
          this.holding = false;
          this.setPressed(null);
          return;
        }
        this.setPressed(this.itemAt(ev.local.x));
        ev.handled = true;
      } else if (inner.kind === 'up' && this.holding) {
        this.holding = false;
        seam.releaseCapture();
        const target = this.itemAt(ev.local.x); // the item under the release point
        this.setPressed(null);
        if (target?.command !== undefined && seam.isCommandEnabled(target.command)) {
          seam.emitCommand(target.command);
        }
        ev.handled = true;
      }
      return;
    }
    if (inner.type !== 'key') return;

    for (const item of this.commandItems()) {
      if (
        item.key !== undefined &&
        item.command !== undefined &&
        matchesChord(item.key, inner) &&
        seam.isCommandEnabled(item.command)
      ) {
        seam.emitCommand(item.command);
        ev.handled = true;
        return;
      }
    }
  }
}

/**
 * Build a {@link StatusLine} from a heterogeneous list of views: command items ({@link statusItem}),
 * flexible `spacer()`s, and any fitting 1-row passive widget. This only assembles the row; the
 * application wires up behaviour when you pass the line to `createApplication`.
 *
 * @param children The status children, laid out left-to-right in order.
 * @returns A constructed `StatusLine`.
 * @example
 * import { createApplication, statusLine, statusItem, spacer, Commands, ProgressBar, signal } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const value = signal(0.5);
 * const status = statusLine([
 *   statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
 *   spacer(),                               // fill — pushes the widgets to the right
 *   new ProgressBar({ value }),             // an embedded passive widget
 *   statusItem(() => new Date().toLocaleTimeString()), // a live, command-less clock
 * ]);
 * const app = createApplication({ caps: resolveCapabilities().profile, statusLine: status });
 */
export function statusLine(children: View[]): StatusLine {
  const line = new StatusLine();
  for (const child of children) line.add(child);
  return line;
}
