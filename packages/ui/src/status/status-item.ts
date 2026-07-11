/**
 * A single status-line entry, as a self-drawing view.
 *
 * A `StatusItemView` is either an **interactive command shortcut** (a label plus the command it
 * emits and an optional accelerator) or a **passive labelled segment** (no command — it never emits
 * and is skipped by clicks and accelerators). The label may be a plain string or a getter
 * (`() => string`) for a live read-out that re-measures and repaints itself when its signals change.
 *
 * The view is presentational: it draws its own ` label ` span and highlight, but the owning
 * {@link StatusLine} drives all interaction (press capture, drag re-target, emit-on-release, the
 * accelerator sweep) and pushes the pressed/enabled state each item draws against.
 */
import type { Style } from '@jsvision/core';
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import { parseTilde, tildeSegments, accentStyle } from '../menu/index.js';

/**
 * A status entry's readable contract: its (possibly live) label, the command it emits, and an
 * optional accelerator. `statusItem()` returns a {@link StatusItemView}, which satisfies this type —
 * so `const entry: StatusItem = statusItem(...)` types and `entry.command` reads.
 */
export interface StatusItem {
  /** Display label, or a getter for a live one; `~X~` marks the accent character. */
  readonly text: string | (() => string);
  /** The command emitted when clicked or when its accelerator is pressed; omitted ⇒ a passive label. */
  readonly command?: string;
  /** Optional accelerator label, e.g. `'Alt+X'`, `'Ctrl+Q'`, or `'F1'`. */
  readonly key?: string;
}

/** Resolves whether a command is currently enabled; the {@link StatusLine} pushes it to each item. */
export type EnabledResolver = (command: string) => boolean;

/**
 * The presentational status entry view. Build one with {@link statusItem} and drop it into
 * {@link statusLine}; the status line owns interaction, so you never wire events on it yourself.
 *
 * @example
 * import { statusLine, statusItem, Commands, signal } from '@jsvision/ui';
 *
 * const clock = signal('12:00:00');
 * const line = statusLine([
 *   statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'), // interactive command item
 *   statusItem(() => clock()),                          // passive live label (no command)
 * ]);
 */
export class StatusItemView extends View implements StatusItem {
  /** Display label, or a getter for a live one; `~X~` marks the accent character. */
  readonly text: string | (() => string);
  /** The command emitted when activated; `undefined` for a passive label. */
  readonly command?: string;
  /** Optional accelerator label, e.g. `'Alt+X'` or `'F4'`. */
  readonly key?: string;

  /** @internal Set by {@link StatusLine} while this item is the held press target (drawn selected). */
  pressed = false;
  /** @internal Enabled resolver pushed by {@link StatusLine} on attach; defaults to always-enabled. */
  isEnabled: EnabledResolver = () => true;

  /**
   * @param text    The display label, or a `() => string` getter for a live one.
   * @param command Optional command to emit; omit for a passive label.
   * @param key     Optional accelerator label, e.g. `'Alt+X'`.
   */
  constructor(text: string | (() => string), command?: string, key?: string) {
    super();
    this.text = text;
    this.command = command;
    this.key = key;
    this.focusable = false;
    if (typeof text === 'function') {
      // A live label re-measures and repaints when its signals change — a wider string must be able
      // to grow its own span, so this reflows (not just repaints). Bind on mount: the reactive scope
      // exists only once the view is live.
      this.onMount(() => this.bind(text, undefined, { relayout: true }));
    }
  }

  /** The raw label (accessor resolved), with `~…~` markers intact. */
  private rawText(): string {
    return typeof this.text === 'function' ? this.text() : this.text;
  }

  /**
   * Natural size: the display text plus one pad column on each side, one row tall — so items abut
   * with no gap and a container's `auto` sizing gives each its exact span.
   *
   * @returns The `{ width, height: 1 }` this item wants.
   */
  override measure(): Size2D {
    return { width: parseTilde(this.rawText()).text.length + 2, height: 1 };
  }

  /**
   * Paint the ` label ` span and its `~…~` accent run(s). The span colour follows the pressed +
   * enabled state pushed by the status line: pressed → the selected (green) palette, disabled →
   * greyed; the accent run takes the matching hotkey colour (and lights up while the accelerator
   * overlay is revealed) unless the item is disabled.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const base = ctx.color('statusBar');
    const selected = ctx.color('statusSelected');
    const dimFg = ctx.role('shadow').fg; // darkGray — the greyed foreground for a disabled item
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

    const enabled = this.command === undefined || this.isEnabled(this.command);
    const style = this.pressed ? (enabled ? selected : selDim) : enabled ? base : dim;
    const hotStyle = this.pressed ? selAccent : accent;

    const raw = this.rawText();
    const width = parseTilde(raw).text.length + 2;
    ctx.fillRect(0, 0, width, 1, ' ', style); // colour the full span, both pad columns included
    for (const seg of tildeSegments(raw)) {
      ctx.text(1 + seg.col, 0, seg.text, enabled && seg.hot ? hotStyle : style);
    }
  }
}

/**
 * Build a status entry for a {@link statusLine}. `command` is optional — omit it for a passive
 * label; `text` may be a live `() => string` getter that repaints itself on change.
 *
 * @param text    The display label, or a `() => string` getter; `~X~` marks the accent character.
 * @param command Optional command emitted when the item is clicked or its accelerator is pressed.
 * @param key     Optional accelerator label, e.g. `'Alt+X'` or `'F4'`.
 * @returns A `StatusItemView` ready to drop into {@link statusLine}.
 * @example
 * import { statusItem, Commands } from '@jsvision/ui';
 *
 * const exit = statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X');
 * const hint = statusItem('~Tab~ Switch panes'); // passive: no command
 */
export function statusItem(text: string | (() => string), command?: string, key?: string): StatusItemView {
  return new StatusItemView(text, command, key);
}
