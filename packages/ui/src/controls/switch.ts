/**
 * {@link Switch} — a compact on/off toggle bound to a two-way `Signal<boolean>`. It follows the
 * {@link Slider} idiom (a single-value `View`, not a `Cluster`): one row showing an optional caption,
 * a bracketed sliding track with a knob on the left (off) or right (on), and an optional `On`/`Off`
 * word. Toggle it with `Space`/`Enter` while focused, a click anywhere on it, or — when the caption
 * marks a `~X~` letter — that `Alt`+hotkey from anywhere in the same dialog.
 *
 * Colours reuse existing roles (no new theme role): the on track is painted green (`button`, or
 * `buttonFocused` when focused), the off track dim (`staticText`), and a disabled switch is drawn in
 * `clusterDisabled`. The knob is `●`, falling back to `o` on a terminal without Unicode. The flip is
 * instant (no animation).
 *
 * Footgun: like every `auto`-sized view, `Switch` relies on {@link Switch.measure} for its intrinsic
 * width — placing it with no explicit size and no `measure()` would collapse it to `{0,0}`. It
 * supplies `measure()`, so laying it out in an `auto` slot just works.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { Size2D } from '../layout/index.js';
import type { Signal } from '../reactive/index.js';
import type { Style } from '@jsvision/core';
import { parseTilde, tildeSegments, accentStyle } from '../menu/index.js';
import type { ParsedLabel } from '../menu/index.js';
import { stringWidth } from './measure.js';

/** The knob glyph (`●`) marking the switch state; falls back to `o` without Unicode. */
const KNOB = '●';
/** ASCII knob fallback under a no-Unicode terminal. */
const KNOB_ASCII = 'o';
/** Inner track width in cells — the knob slides between column 0 (off) and column 3 (on). */
const TRACK_INNER = 4;
/** Full track width including the `[`…`]` brackets. */
const TRACK_WIDTH = TRACK_INNER + 2;

/** Construction options for a {@link Switch}. */
export interface SwitchOptions {
  /** Two-way bound on/off state: reading renders the knob; an external write repaints. */
  value: Signal<boolean>;
  /** Optional caption drawn left of the track; `~X~` marks an `Alt`+hotkey. */
  label?: string;
  /** Text shown right of the track when on (default `'On'`); `''` hides it. */
  onLabel?: string;
  /** Text shown right of the track when off (default `'Off'`); `''` hides it. */
  offLabel?: string;
  /** Non-interactive and dim when true (also not focusable). */
  disabled?: boolean;
}

/**
 * A focusable on/off toggle bound two-way to a `Signal<boolean>` (see the module docs for glyphs,
 * colours, and interaction).
 *
 * @example
 * import { Group, Switch, signal, createEventLoop } from '@jsvision/ui';
 * import { resolveCapabilities } from '@jsvision/core';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const wifi = signal(false);
 * const sw = new Switch({ value: wifi, label: '~W~i-Fi', onLabel: 'On', offLabel: 'Off' });
 * sw.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 1 } };
 *
 * const root = new Group();
 * root.add(sw);
 * const loop = createEventLoop({ width: 20, height: 1 }, { caps });
 * loop.mount(root);
 * loop.focusView(sw);
 * // Space/Enter, a click, or Alt+W toggles it:
 * wifi.set(true); // drive it externally — the knob slides right and the track turns green
 */
export class Switch extends View {
  /** The switch takes focus so `Space`/`Enter` toggling is scoped to it (disabled ⇒ not focusable). */
  override focusable = true;
  /** Post-process so its `Alt`+hotkey works even when another control in the dialog holds focus. */
  override postProcess = true;

  /** Two-way on/off value (source of truth). */
  protected readonly value: Signal<boolean>;
  /** The raw caption (with tildes), or `''` when unlabelled. */
  protected readonly raw: string;
  /** The parsed caption (display text + `~X~` hotkey). */
  protected readonly parsed: ParsedLabel;
  /** Text shown when on / off (either may be `''` to hide it). */
  protected readonly onLabel: string;
  protected readonly offLabel: string;

  /**
   * @param opts The two-way `value` plus an optional `label`/`onLabel`/`offLabel`/`disabled`.
   */
  constructor(opts: SwitchOptions) {
    super();
    this.value = opts.value;
    this.raw = opts.label ?? '';
    this.parsed = parseTilde(this.raw);
    this.onLabel = opts.onLabel ?? 'On';
    this.offLabel = opts.offLabel ?? 'Off';
    this.state.disabled = opts.disabled ?? false; // also gates focusability via the focus manager
    // Repaint when the value changes externally (View.draw is not auto-tracked).
    this.onMount(() =>
      this.bind(
        () => this.value(),
        () => undefined,
      ),
    );
  }

  /** The caption's `~X~` Alt-hotkey char (lowercase), for duplicate-accelerator detection; none if unmarked. */
  override accelerators(): readonly string[] {
    return this.parsed.hotkey !== null ? [this.parsed.hotkey] : [];
  }

  /** Advertise the intrinsic single-row size: caption + track + on/off word. */
  override measure(): Size2D {
    let width = TRACK_WIDTH;
    if (this.parsed.text.length > 0) width += stringWidth(this.parsed.text) + 1; // caption + gap
    const textW = Math.max(stringWidth(this.onLabel), stringWidth(this.offLabel));
    if (textW > 0) width += textW + 1; // gap + widest on/off word (so a toggle never clips)
    return { width, height: 1 };
  }

  /** Programmatically set the on/off value (a no-op when disabled). */
  select(on: boolean): void {
    if (this.state.disabled) return;
    if (this.value() !== on) this.value.set(on);
  }

  /** Paint the caption (if any), the bracketed track with the knob at its state end, and the on/off word. */
  override draw(ctx: DrawContext): void {
    const disabled = this.state.disabled;
    const on = this.value();
    const focused = this.state.focused && !disabled;

    // Fill the row in the neutral field colour so the caption/word sit on a solid background.
    const field = ctx.color('staticText');
    ctx.fill(' ', field);

    let x = 0;
    if (this.parsed.text.length > 0) {
      const accent = disabled ? field : accentStyle(ctx.color('labelShortcut'), ctx.revealAccelerators);
      for (const seg of tildeSegments(this.raw)) ctx.text(x + seg.col, 0, seg.text, seg.hot ? accent : field);
      x += stringWidth(this.parsed.text) + 1;
    }

    // Track colours: dim when off, green when on (brighter fg when focused), cyan-dim when disabled.
    const trackStyle: Style = disabled
      ? ctx.color('clusterDisabled')
      : on
        ? ctx.color(focused ? 'buttonFocused' : 'button')
        : ctx.color('staticText');
    // The brackets pick up the focus accent so an off (dim) switch still shows focus.
    const bracketStyle: Style = focused ? ctx.color('buttonFocused') : trackStyle;
    const knob = ctx.caps.unicode.utf8 ? KNOB : KNOB_ASCII;
    const knobIndex = on ? TRACK_INNER - 1 : 0; // right when on, left when off

    ctx.text(x, 0, '[', bracketStyle);
    for (let i = 0; i < TRACK_INNER; i += 1) ctx.text(x + 1 + i, 0, i === knobIndex ? knob : ' ', trackStyle);
    ctx.text(x + 1 + TRACK_INNER, 0, ']', bracketStyle);
    x += TRACK_WIDTH;

    const word = on ? this.onLabel : this.offLabel;
    if (word.length > 0) ctx.text(x + 1, 0, word, field);
  }

  /**
   * Route toggling input: `Space`/`Enter` while focused, a click anywhere on the control (focus +
   * toggle), and the caption's `Alt`+hotkey from anywhere in the scope (focus + toggle). A disabled
   * switch is inert.
   *
   * @param ev The dispatch envelope (carries `local`/`focusView` during real dispatch).
   */
  override onEvent(ev: DispatchEvent): void {
    if (this.state.disabled) return; // dim and inert (and non-focusable)
    const inner = ev.event;

    if (inner.type === 'mouse') {
      // Toggle on the press; the hit-test already climbs focus to this focusable view.
      if (inner.kind === 'down') {
        this.toggle();
        ev.focusView?.(this);
        ev.handled = true;
      }
      return;
    }

    if (inner.type !== 'key') return;
    const isHotkey =
      inner.alt &&
      this.parsed.hotkey !== null &&
      inner.key.length === 1 &&
      inner.key.toLowerCase() === this.parsed.hotkey;
    if (isHotkey) {
      this.toggle();
      ev.focusView?.(this); // an Alt-hotkey also moves focus here
      ev.handled = true;
      return;
    }
    if ((inner.key === 'space' || inner.key === 'enter') && this.state.focused) {
      this.toggle();
      ev.handled = true;
    }
  }

  /** Flip the bound value (the value bind repaints). */
  protected toggle(): void {
    this.value.set(!this.value());
  }
}
