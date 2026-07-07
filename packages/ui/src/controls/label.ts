/**
 * A single-line caption that is wired to another control. Clicking the label, or pressing its
 * `Alt`+hotkey, moves focus to the linked control; the label highlights while that control is
 * focused. Mark the hotkey letter by wrapping it in tildes — `'~N~ame'` makes `N` the accelerator.
 *
 * A `Label` is not focusable itself and is never in the Tab order — it exists to give another
 * control a clickable, keyboard-reachable caption.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { parseTilde, tildeSegments, accentStyle } from '../menu/index.js';
import type { ParsedLabel } from '../menu/index.js';

/**
 * A caption linked to a control. Construct it with the control it should focus.
 *
 * @example
 * import { Group, Label, Input, signal } from '@jsvision/ui';
 *
 * const name = signal('');
 * const input = new Input({ value: name });
 * const label = new Label('~N~ame', input); // Alt+N or a click focuses `input`
 *
 * label.layout = { position: 'absolute', rect: { x: 1, y: 0, width: 6, height: 1 } };
 * input.layout = { position: 'absolute', rect: { x: 8, y: 0, width: 20, height: 1 } };
 *
 * const form = new Group();
 * form.add(label);
 * form.add(input);
 */
export class Label extends View {
  /** Caught in the post-process sweep so its `Alt`+hotkey works even though the label is not focusable. */
  override postProcess = true;
  /** The original tilde-marked caption text. */
  protected readonly raw: string;
  /** The control focused on click / hotkey. */
  protected readonly link: View;
  /** Parsed hotkey (letter + column), for `Alt`+hotkey matching. */
  protected readonly parsed: ParsedLabel;

  /**
   * @param text A caption, optionally marking its hotkey with `~X~` (e.g. `'~N~ame'`).
   * @param link The control focused when the label is clicked or its `Alt`+hotkey is pressed.
   */
  constructor(text: string, link: View) {
    super();
    this.raw = text;
    this.link = link;
    this.parsed = parseTilde(text);
    // The label must repaint when the LINKED control's focus flips (to swap its highlight). Reading
    // the link's focus-change signal here subscribes to it; a plain `link.state.focused` read would
    // not, and the framework only invalidates the link on a focus change, not this label.
    this.onMount(() => this.bind(() => this.link.focusSignal()()));
  }

  /**
   * Paint the caption: base text (highlighted while the linked control is focused) with the hotkey
   * letter accented.
   *
   * @param ctx The clipped, view-local paint context.
   */
  override draw(ctx: DrawContext): void {
    const base = ctx.color(this.link.state.focused ? 'labelSelected' : 'label');
    const accent = accentStyle(ctx.color('labelShortcut'), ctx.revealAccelerators);
    const { width, height } = ctx.size;
    ctx.fillRect(0, 0, width, height, ' ', base);
    for (const seg of tildeSegments(this.raw)) {
      ctx.text(seg.col, 0, seg.text, seg.hot ? accent : base);
    }
  }

  /**
   * Focus the linked control on a click, or on this label's `Alt`+hotkey (caught in the post-process
   * phase since the label is not in the focus chain).
   *
   * @param ev The dispatch envelope (carries `focusView`/`local` during real dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      ev.focusView?.(this.link);
      ev.handled = true;
      return;
    }
    // Alt+hotkey (a single-character key with the Alt modifier) focuses the linked control.
    if (
      inner.type === 'key' &&
      inner.alt &&
      this.parsed.hotkey !== null &&
      inner.key.length === 1 &&
      inner.key.toLowerCase() === this.parsed.hotkey
    ) {
      ev.focusView?.(this.link);
      ev.handled = true;
    }
  }
}
