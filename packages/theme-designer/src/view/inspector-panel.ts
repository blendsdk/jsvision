/**
 * The right panel — the color inspector for the selected target: three R/G/B {@link Slider}s, a
 * `#rrggbb` hex {@link Input}, a DOS-16 {@link ColorSwatch}, a WCAG contrast readout, and a
 * color-depth sample strip. The sliders and hex field bind app-owned signals; the app watches those
 * signals to push edits into the model (and keeps them in sync), so this module only builds the view.
 */
import { Group, Text, Slider, Input, ColorSwatch } from '@jsvision/ui';
import type { Signal, View } from '@jsvision/ui';
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
  /** The model (for the live contrast + depth readouts). */
  model: DesignerModel;
  /** Called when the swatch picks a color (the app commits it to the selected target). */
  onSwatchInput: (c: Color) => void;
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
 * @param deps The channel/hex/color signals, the model, and the swatch-commit callback.
 * @returns A {@link Group} (fixed-width column) with the picker, contrast, and depth readouts.
 * @example
 * import { buildInspectorPanel } from './view/inspector-panel.js';
 * const view = buildInspectorPanel({ r, g, b, hexText, color, model, onSwatchInput });
 */
export function buildInspectorPanel(deps: InspectorDeps): Group {
  const view = new Group();
  view.background = 'dialog';

  at(view, new Text('Inspector'), 1, 0, 28, 1);

  at(view, new Text('R'), 1, 2, 2, 1);
  at(view, new Slider({ value: deps.r, min: 0, max: 255 }), 4, 2, 24, 1);
  at(view, new Text('G'), 1, 3, 2, 1);
  at(view, new Slider({ value: deps.g, min: 0, max: 255 }), 4, 3, 24, 1);
  at(view, new Text('B'), 1, 4, 2, 1);
  at(view, new Slider({ value: deps.b, min: 0, max: 255 }), 4, 4, 24, 1);

  at(view, new Text('Hex'), 1, 6, 4, 1);
  at(view, new Input({ value: deps.hexText, validator: hexValidator }), 6, 6, 12, 1);

  at(
    view,
    new ColorSwatch({ value: deps.color, onInput: deps.onSwatchInput, onChange: deps.onSwatchInput }),
    1,
    8,
    12,
    4,
  );

  at(view, new Text('Contrast'), 1, 13, 28, 1);
  at(
    view,
    new Text(() =>
      contrastRows(deps.model.theme())
        .map((row) => `${row.pair}: ${row.ratio.toFixed(1)} ${row.level}`)
        .join('\n'),
    ),
    1,
    14,
    30,
    8,
  );

  at(view, new Text('Depth'), 1, 23, 28, 1);
  at(
    view,
    new Text(() =>
      depthSamples(deps.color())
        .map((s) => `${s.depth} ${s.hex}`)
        .join('   '),
    ),
    1,
    24,
    30,
    2,
  );

  return view;
}
