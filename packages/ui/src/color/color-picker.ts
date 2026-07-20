/**
 * {@link ColorPicker} — a compact one-line color field: a color **chip** plus a trailing `▐↓▌`
 * dropdown button that opens a {@link ColorSwatch} (and an optional hex `Input`) in a popup anchored
 * to the field.
 *
 * The chip shows the current `value` as a colored block plus a caption. Open the dropdown with Down,
 * Alt+Down, or a click on the button. Inside the popup, picking a swatch cell (releasing over it or
 * pressing Enter) commits the color and closes; when `allowCustom` is on, a hex field accepts any
 * `#rrggbb` truecolor (a complete valid value updates the selection, an incomplete/invalid one is
 * ignored). The swatch and hex field share the picker's `value` and stay in sync without churning a
 * named color (e.g. `'red'`) into its hex form. With no overlay host available (headless), opening is
 * a no-op.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import type { LayoutProps } from '../layout/index.js';
import { signal, untrack } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { PALETTE, ANSI16_ORDER, toRgb } from '@jsvision/core';
import type { Color, Style, Rgb } from '@jsvision/core';
import { Input, filter } from '../controls/index.js';
import { openAnchoredPopup, absoluteRect, drawDropdownIcon } from '../dropdown/index.js';
import { ColorSwatch } from './color-swatch.js';
import { gridDims, isNearBlack } from './color-grid.js';

/** Minimum popup width when `allowCustom` is on — room for `#rrggbb` plus padding. */
const HEX_MIN = 9;
/** The hex field's allowed charset: `#` plus hex digits (enforced live by the input filter). */
const HEX_CHARSET = '#0-9a-fA-F';
/** Max hex length (`#rrggbb`). */
const HEX_MAX = 7;

/** Serialize a color to a normalized `#rrggbb` (or `''` for `'default'` / a malformed color). */
function colorToHex(c: Color): string {
  let rgb: Rgb | null;
  try {
    rgb = toRgb(c);
  } catch {
    return '';
  }
  if (rgb === null) return '';
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** A complete valid hex string as a `Color`, or `null` (incomplete/invalid — leaves `value` unchanged). */
function parseHex(text: string): Color | null {
  if (text === '') return null;
  try {
    toRgb(text as Color);
    return text as Color;
  } catch {
    return null;
  }
}

/** Whether two colors resolve to the same RGB (so a named `value` isn't churned to its hex form). */
function rgbEqual(a: Color, b: Color): boolean {
  let ra: Rgb | null;
  let rb: Rgb | null;
  try {
    ra = toRgb(a);
    rb = toRgb(b);
  } catch {
    return false;
  }
  if (ra === null || rb === null) return ra === rb;
  return ra.r === rb.r && ra.g === rb.g && ra.b === rb.b;
}

/**
 * The trigger chip — drawn as an input-style field so the picker looks like a text field, not a plain
 * caption: the field background is the selected input colour while the picker is focused and the
 * normal input colour otherwise, a 2-cell color block sits at the left (a near-black block gets a
 * light-gray background so it stays visible), and the caption (the color's name, the `label`, or the
 * raw color) follows. Display-only and not focusable — the `ColorPicker` group itself is the trigger.
 * Repaints on a `value` change and on the picker gaining/losing focus.
 */
class ColorChip extends View {
  constructor(
    private readonly value: Signal<Color>,
    private readonly focusSource: View,
    private readonly label?: string,
    private readonly nameFor?: (c: Color) => string,
  ) {
    super();
    this.onMount(() =>
      this.bind(() => {
        this.value();
        this.focusSource.focusSignal()();
      }),
    );
  }

  draw(ctx: DrawContext): void {
    const { width: w, height: h } = ctx.size;
    const field: Style = ctx.color(this.focusSource.state.focused ? 'inputSelected' : 'inputNormal');
    ctx.fillRect(0, 0, w, h, ' ', field); // the input-style field background
    const c = this.value();
    const block: Style = isNearBlack(c) ? { fg: c, bg: PALETTE.lightGray } : { fg: c, bg: field.bg };
    ctx.fillRect(0, 0, 2, 1, '█', block); // the 2-cell color block at the left
    const caption = this.nameFor?.(c) ?? this.label ?? c;
    if (w > 3) ctx.text(3, 0, caption.slice(0, w - 3), field); // caption after the block
  }
}

/**
 * The trailing 3-cell dropdown button drawing the shared `▐↓▌` icon. Not focusable; a mouse-down opens
 * the popup.
 */
class ColorButton extends View {
  override readonly layout: Readonly<LayoutProps> = { size: { kind: 'fixed', cells: 3 } };

  constructor(private readonly onOpen: (ev: DispatchEvent) => void) {
    super();
  }

  draw(ctx: DrawContext): void {
    drawDropdownIcon(ctx, 0);
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      this.onOpen(ev);
      ev.handled = true;
    }
  }
}

/**
 * The popup body group `[ ColorSwatch (fr) | hex Input (1) ]`. Catches **Enter** in the focus-chain
 * bubble when the hex `Input` holds focus (the swatch handles its own Enter via `onChange`) → close.
 */
class PickerBody extends Group {
  override readonly layout: Readonly<LayoutProps> = { direction: 'col' };

  constructor(
    private readonly onClose: () => void,
    private readonly hex?: Input,
  ) {
    super();
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'enter' && this.hex !== undefined && this.hex.state.focused) {
      this.onClose(); // value is already set by the two-way bind; Enter just closes the popup
      ev.handled = true;
    }
  }
}

/** Options for a {@link ColorPicker}. */
export interface ColorPickerOptions {
  /** Two-way selected color (shared with the hosted swatch + hex field). */
  value: Signal<Color>;
  /** Palette forwarded to the `ColorSwatch` (default {@link ANSI16_ORDER}). */
  colors?: readonly Color[];
  /** Columns forwarded to the `ColorSwatch` (default 4). */
  columns?: number;
  /** Include a hex `Input` in the popup for arbitrary `#rrggbb` truecolor (default true). */
  allowCustom?: boolean;
  /** Optional chip caption prefix (used when `nameFor` is absent). */
  label?: string;
  /** Optional name accessor for the chip caption. */
  nameFor?: (c: Color) => string;
  /** Fired on every live value change in the popup (arrow / click / drag). */
  onInput?: (c: Color) => void;
  /** Fired on the discrete commit gesture (Enter / Space / mouse-up), which also closes the popup. */
  onChange?: (c: Color) => void;
}

/**
 * A one-line color picker: a color chip that opens a swatch (plus an optional hex field) in a
 * dropdown anchored to the field.
 *
 * @example
 * import { Group, ColorPicker, signal, at } from '@jsvision/ui';
 * import type { Color } from '@jsvision/core';
 *
 * const g = new Group();
 * const value = signal<Color>('red');
 *
 * // A picker with the hex field enabled so custom #rrggbb colors are allowed.
 * const picker = at(
 *   new ColorPicker({ value, allowCustom: true, onChange: (c) => console.log(c) }),
 *   10,
 *   0,
 *   20,
 *   1,
 * );
 * g.add(picker);
 * // Down / Alt+Down / clicking the ▐↓▌ button opens the swatch; Esc or an outside click cancels.
 */
export class ColorPicker extends Group {
  /** The picker itself takes focus (the chip is display-only); Down/Alt+Down opens the dropdown. */
  override focusable = true;

  /** Two-way selected color. */
  readonly value: Signal<Color>;

  protected readonly colors?: readonly Color[];
  protected readonly columns: number;
  protected readonly allowCustom: boolean;
  protected readonly nameFor?: (c: Color) => string;
  protected readonly onInput?: (c: Color) => void;
  protected readonly onChange?: (c: Color) => void;
  protected readonly chip: ColorChip;
  protected readonly button: ColorButton;

  /**
   * @param opts The two-way `value` + optional `colors`/`columns`/`allowCustom`/`label`/`nameFor`/
   *             `onInput`/`onChange`.
   */
  constructor(opts: ColorPickerOptions) {
    super();
    this.value = opts.value;
    this.colors = opts.colors;
    this.columns = opts.columns ?? 4;
    this.allowCustom = opts.allowCustom ?? true;
    this.nameFor = opts.nameFor;
    this.onInput = opts.onInput;
    this.onChange = opts.onChange;
    this.setLayout({ direction: 'row' });
    this.chip = new ColorChip(this.value, this, opts.label, opts.nameFor);
    this.chip.setLayout({ size: { kind: 'fr', weight: 1 } });
    this.button = new ColorButton((ev) => this.open(ev));
    this.add(this.chip);
    this.add(this.button);
  }

  /**
   * Open on Down / Alt+Down while the picker is focused (the chip is display-only; the picker itself
   * takes focus). A mouse-down on the trailing button opens via {@link ColorButton}.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'down' && (this.state.focused || inner.alt)) {
      this.open(ev);
      ev.handled = true;
    }
  }

  /**
   * Focus the picker, then open the anchored popup hosting a `ColorSwatch` (+ hex `Input`) bound to the
   * shared `value`. The swatch's `onChange` (commit) fires the picker's `onChange` and closes the popup
   * (the value is already set). A no-op with no overlay host (headless).
   *
   * @param ev The dispatch envelope (source of the popup host + focus seam).
   */
  protected open(ev: DispatchEvent): void {
    const host = ev.popupHost;
    if (host === undefined) return; // no overlay host (headless / no shell) → decline to open
    ev.focusView?.(this);
    const palette = this.colors ?? (ANSI16_ORDER as readonly Color[]);
    const { width: gridWidth, rows } = gridDims(palette.length, this.columns);
    const allowCustom = this.allowCustom;
    const contentWidth = allowCustom ? Math.max(gridWidth, HEX_MIN) : gridWidth;
    const rowCount = rows + (allowCustom ? 1 : 0);

    openAnchoredPopup({
      host,
      anchor: absoluteRect(this),
      buildContent: (commit) => {
        const swatch = new ColorSwatch({
          value: this.value,
          colors: this.colors,
          columns: this.columns,
          nameFor: this.nameFor,
          onInput: this.onInput, // live: forward the picker's onInput on every arrow / click / drag
          onChange: (c) => {
            this.onChange?.(c); // commit: fire the picker's onChange…
            commit(); // …then close the popup (the value is already set live)
          },
        });
        swatch.setLayout({ size: { kind: 'fr', weight: 1 } });
        let hex: Input | undefined;
        if (allowCustom) {
          const hexText = signal(colorToHex(untrack(() => this.value())));
          hex = new Input({ value: hexText, validator: filter(HEX_CHARSET), maxLength: HEX_MAX });
          hex.setLayout({ size: { kind: 'fixed', cells: 1 } });
          hex.onMount(() => this.wireHexBind(hex!, hexText));
        }
        const body = new PickerBody(commit, hex);
        body.add(swatch);
        if (hex !== undefined) body.add(hex);
        return body;
      },
      // The popup sizes to the grid (+ hex row) + 1 row of placement border compensation (popup contract).
      contentSize: { width: contentWidth, height: rowCount + 1 },
      focusTarget: (content) => (content as Group).children[0], // grid-first: focus the ColorSwatch
    });
  }

  /**
   * Wire the two-way binding between `value` and the hex field's text. `value → text` serializes the
   * color to a normalized `#rrggbb`; `text → value` parses a complete valid hex and updates `value`
   * only when its RGB actually differs. Each direction reads only the *other* signal, so there is no
   * feedback loop, and the RGB-equality guard keeps a named color (e.g. `'red'`) from being rewritten
   * to its `#aa0000` form when the popup opens.
   */
  protected wireHexBind(hex: Input, hexText: Signal<string>): void {
    hex.bind(
      () => this.value(),
      (v) => {
        const t = colorToHex(v);
        if (t !== untrack(() => hexText())) hexText.set(t);
      },
    );
    hex.bind(
      () => parseHex(hexText()),
      (parsed) => {
        if (parsed === null) return; // incomplete / invalid hex → leave the value unchanged
        const cur = untrack(() => this.value());
        if (!rgbEqual(cur, parsed)) this.value.set(parsed);
      },
    );
  }
}
