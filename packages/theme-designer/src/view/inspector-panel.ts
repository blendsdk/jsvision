/**
 * The right panel — the color inspector for the selected target: a heading showing what is being
 * edited, a background/foreground field toggle (for role targets), three R/G/B {@link Slider}s, a
 * `#rrggbb` hex {@link Input}, a DOS-16 {@link ColorSwatch}, a WCAG contrast readout, and a
 * color-depth sample strip. The sliders, hex field, and field toggle bind app-owned signals; the app
 * watches those signals to push edits into the model (and keeps them in sync), so this module only
 * builds the view.
 */
import { Group, Text, Slider, Input, ColorSwatch, RadioGroup, View } from '@jsvision/ui';
import type { Signal, DrawContext } from '@jsvision/ui';
import type { Color } from '@jsvision/core';

import { contrastRows, depthSamples, hexValidator } from '../model/index.js';
import type { DesignerModel } from '../model/index.js';

/** The app-owned inspector state + callbacks the view binds to. */
export interface InspectorDeps {
  /** Red/green/blue channel signals (0–255) the sliders bind two-way. */
  r: Signal<number>;
  g: Signal<number>;
  b: Signal<number>;
  /** The `#rrggbb` text the hex field binds two-way. */
  hexText: Signal<string>;
  /** The current color the swatch displays. */
  color: Signal<Color>;
  /** Which field of a role target is edited: 0 = background, 1 = foreground (the toggle binds this). */
  fieldIndex: Signal<number>;
  /** The model (for the live contrast + depth readouts and the "editing" heading). */
  model: DesignerModel;
  /** Called when the swatch picks a color (the app commits it to the selected target). */
  onSwatchInput: (c: Color) => void;
}

/**
 * A solid block filled with a live color — the true (truecolor) preview of the color being edited.
 * The DOS-16 {@link ColorSwatch} below it only shows the nearest palette slot; this shows the exact
 * value. It repaints whenever its color signal changes, so a bare rail selection (which swaps the
 * loaded color without swapping the theme, so the app's theme-driven repaint never fires) still
 * updates the block.
 */
class ColorBlock extends View {
  constructor(private readonly read: () => Color) {
    super();
    this.focusable = false;
    this.onMount(() => this.bind(() => this.read()));
  }

  draw(ctx: DrawContext): void {
    const c = this.read();
    ctx.fill(' ', { fg: c, bg: c });
  }
}

/** Place a view at an absolute rect inside a group. */
function at<T extends View>(g: Group, view: T, x: number, y: number, w: number, h: number): T {
  view.layout = { position: 'absolute', rect: { x, y, width: w, height: h } };
  g.add(view);
  return view;
}

/**
 * Build the inspector panel over app-owned signals.
 *
 * @param deps The channel/hex/color/field signals, the model, and the swatch-commit callback.
 * @returns A {@link Group} (fixed-width column) with the picker, field toggle, contrast, and depth readouts.
 * @example
 * import { buildInspectorPanel } from './view/inspector-panel.js';
 * const view = buildInspectorPanel({ r, g, b, hexText, color, fieldIndex, model, onSwatchInput });
 */
export function buildInspectorPanel(deps: InspectorDeps): Group {
  const view = new Group();
  view.background = 'dialog';

  at(view, new Text('Inspector'), 1, 0, 28, 1);
  // What is being edited — updates live when the rail selection changes.
  at(
    view,
    new Text(() => {
      const t = deps.model.state().selected;
      return `Editing: ${t.kind === 'alias' ? 'α' : '▸'} ${String(t.name)}`;
    }),
    1,
    1,
    30,
    1,
  );
  // Background/foreground toggle — only meaningful for a role (an alias is a single color).
  at(view, new RadioGroup({ labels: ['back~g~round', '~f~oreground'], value: deps.fieldIndex }), 1, 2, 16, 2);

  at(view, new Text('R'), 1, 5, 2, 1);
  at(view, new Slider({ value: deps.r, min: 0, max: 255 }), 4, 5, 24, 1);
  at(view, new Text('G'), 1, 6, 2, 1);
  at(view, new Slider({ value: deps.g, min: 0, max: 255 }), 4, 6, 24, 1);
  at(view, new Text('B'), 1, 7, 2, 1);
  at(view, new Slider({ value: deps.b, min: 0, max: 255 }), 4, 7, 24, 1);

  at(view, new Text('Hex'), 1, 9, 4, 1);
  at(view, new Input({ value: deps.hexText, validator: hexValidator }), 6, 9, 12, 1);
  // A solid swatch of the exact edited color, directly under the hex field's column.
  at(view, new ColorBlock(deps.color), 6, 10, 12, 1);

  at(
    view,
    new ColorSwatch({ value: deps.color, onInput: deps.onSwatchInput, onChange: deps.onSwatchInput }),
    1,
    11,
    12,
    4,
  );

  at(view, new Text('Contrast'), 1, 16, 28, 1);
  at(
    view,
    new Text(() =>
      contrastRows(deps.model.theme())
        .map((row) => `${row.pair}: ${row.ratio.toFixed(1)} ${row.level}`)
        .join('\n'),
    ),
    1,
    17,
    30,
    6,
  );

  at(view, new Text('Depth'), 1, 24, 28, 1);
  at(
    view,
    new Text(() =>
      depthSamples(deps.color())
        .map((s) => `${s.depth} ${s.hex}`)
        .join('   '),
    ),
    1,
    25,
    30,
    2,
  );

  return view;
}
