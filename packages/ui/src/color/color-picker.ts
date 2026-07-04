/**
 * `ColorPicker` — a `Group` = a color **chip** + a trailing `▐↓▌` dropdown button that opens a
 * `ColorSwatch` (+ an optional hex `Input`) in the RD-14 anchored popup, mirroring `DatePicker`
 * (`date-picker.ts`) one-for-one. It has **no** Turbo Vision counterpart — a documented extension that
 * compresses TV's heavy `TColorDialog` (61×18 modal editor, `colorsel.cpp:694-749`) into a compact
 * form-field dropdown. It composes shipped pieces + the generalized `openAnchoredPopup` (RD-20 PA-5)
 * and does **not** edit `dropdown/` (AC-9).
 *
 * Composition `[ chip (fr) | ▐↓▌ button (3) ]`: the chip shows the current `value` as a `█` block +
 * caption; the button opens the popup on mouse-down. The popup hosts `[ ColorSwatch (fr) | hex Input
 * (1, allowCustom) ]` sharing the same `value`. Open on Down/Alt+Down or a `▐↓▌` click; a swatch
 * **release over a cell** or **Enter** commits + closes (PA-11 — down alone previews, does not close);
 * the hex field is `filter`-gated + `toRgb()`-parsed (a complete valid `#rrggbb` sets `value`, invalid
 * leaves it unchanged, AC-8). The value⟷text bind reads only the OTHER signal (the ComboBox idiom), so
 * there is no feedback loop; an RGB-equality guard preserves a named `value` against its own hex form.
 * No `PopupHost` ⇒ open declines (headless).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
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

/** Minimum popup width when `allowCustom` is on — room for `#rrggbb` + padding (PF-006). */
const HEX_MIN = 9;
/** The hex field's allowed charset: `#` + hex digits (live-reject via the RD-06 `filter`). */
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
 * The trigger chip — a display block in the current `value`'s color + a caption (`nameFor(value)` /
 * `label` / the raw color string). A near-black block uses a lightGray bg for visibility (the
 * `colorMarker` contrast family). Display-only; not focusable (the `ColorPicker` group is the trigger).
 */
class ColorChip extends View {
  constructor(
    private readonly value: Signal<Color>,
    private readonly label?: string,
    private readonly nameFor?: (c: Color) => string,
  ) {
    super();
    this.onMount(() => this.bind(() => this.value()));
  }

  draw(ctx: DrawContext): void {
    const c = this.value();
    const block: Style = isNearBlack(c) ? { fg: c, bg: PALETTE.lightGray } : { fg: c, bg: PALETTE.black };
    ctx.fillRect(0, 0, 2, 1, '█', block); // the 2-cell color block
    const caption = this.nameFor?.(c) ?? this.label ?? c;
    ctx.text(3, 0, caption, ctx.color('staticText'));
  }
}

/**
 * The trailing 3-cell dropdown button — the **shared** `▐↓▌` icon via `drawDropdownIcon` (byte-identical
 * to ComboBox/DatePicker/History). Not focusable; a mouse-down opens the popup.
 */
class ColorButton extends View {
  override layout: LayoutProps = { size: { kind: 'fixed', cells: 3 } };

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
 * bubble when the hex `Input` holds focus (the swatch handles its own Enter via `onCommit`) → close.
 */
class PickerBody extends Group {
  override layout: LayoutProps = { direction: 'col' };

  constructor(
    private readonly onClose: () => void,
    private readonly hex?: Input,
  ) {
    super();
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'key' && inner.key === 'enter' && this.hex !== undefined && this.hex.state.focused) {
      this.onClose(); // value is already set by the two-way bind; Enter just closes (AC-8)
      ev.handled = true;
    }
  }
}

/** Options for a {@link ColorPicker}. (03-02) */
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
  /** Optional name accessor for the chip caption (PA-13). */
  nameFor?: (c: Color) => string;
  /** Fired when `value` changes via a commit. */
  onChange?: (c: Color) => void;
}

/**
 * A one-line color picker: a chip opening a swatch (+ hex) dropdown. See the module doc.
 */
export class ColorPicker extends Group {
  /** The picker is the focus target (the chip is display-only); Down/Alt+Down opens. */
  override focusable = true;

  /** Two-way selected color. */
  readonly value: Signal<Color>;

  protected readonly colors?: readonly Color[];
  protected readonly columns: number;
  protected readonly allowCustom: boolean;
  protected readonly nameFor?: (c: Color) => string;
  protected readonly onChange?: (c: Color) => void;
  protected readonly chip: ColorChip;
  protected readonly button: ColorButton;

  /**
   * @param opts The two-way `value` + optional `colors`/`columns`/`allowCustom`/`label`/`nameFor`/`onChange`.
   */
  constructor(opts: ColorPickerOptions) {
    super();
    this.value = opts.value;
    this.colors = opts.colors;
    this.columns = opts.columns ?? 4;
    this.allowCustom = opts.allowCustom ?? true;
    this.nameFor = opts.nameFor;
    this.onChange = opts.onChange;
    this.layout = { direction: 'row' };
    this.chip = new ColorChip(this.value, opts.label, opts.nameFor);
    this.chip.layout = { size: { kind: 'fr', weight: 1 } };
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
   * shared `value`. The swatch's `onCommit` closes the popup (the value is already set). A no-op with no
   * overlay host (headless).
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
          onChange: this.onChange,
          onCommit: () => commit(), // a release-over-cell / Enter commit sets value then closes (PA-11)
        });
        swatch.layout = { size: { kind: 'fr', weight: 1 } };
        let hex: Input | undefined;
        if (allowCustom) {
          const hexText = signal(colorToHex(untrack(() => this.value())));
          hex = new Input({ value: hexText, validator: filter(HEX_CHARSET), maxLength: HEX_MAX });
          hex.layout = { size: { kind: 'fixed', cells: 1 } };
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
   * Wire the two-way `value`⟷hex-text bind (the ComboBox idiom): `value → text` serializes `value` to
   * a normalized `#rrggbb` (reading only `value`); `text → value` parses a complete valid hex and sets
   * `value` only when its RGB differs from the current value (reading only `text`, the current value via
   * `untrack`). Neither direction subscribes to the signal it writes → no feedback loop; the RGB guard
   * keeps a named `value` (e.g. `'red'`) from being churned into its `#aa0000` form on open.
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
        if (parsed === null) return; // incomplete / invalid → leave value unchanged (AC-8)
        const cur = untrack(() => this.value());
        if (!rgbEqual(cur, parsed)) this.value.set(parsed);
      },
    );
  }
}
