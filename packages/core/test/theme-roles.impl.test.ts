/**
 * Implementation test — the split-pane divider roles resolve to real, encodable colours.
 *
 * ST-25 pins that `splitter`/`splitterDragging` are present with defined fg/bg across every theme;
 * this goes one step further and proves those colours actually encode at every depth (a role could
 * carry a defined-but-invalid colour and still pass a presence check). The sibling preset round-trip
 * test is serialization-lossless by construction, so it can never catch a wrong colour value — this can.
 */
import { test, expect } from 'vitest';

import type { ColorDepth } from '../src/engine/capability/index.js';
import {
  encode,
  defaultTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  janusTheme,
  warpTheme,
  solsticeTheme,
  platinumTheme,
  workbenchTheme,
  horizonTheme,
} from '../src/engine/color/index.js';
import type { Theme } from '../src/engine/color/index.js';

const ALL_DEPTHS: readonly ColorDepth[] = ['mono', '16', '256', 'truecolor'];
const SPLIT_ROLES = ['splitter', 'splitterDragging'] as const;

/** Every shipped preset — the two hand-authored themes and every createTheme-generated one. */
const PRESETS: Record<string, Theme> = {
  defaultTheme,
  monochromeTheme,
  slateTheme,
  nordTheme,
  draculaTheme,
  solarizedDarkTheme,
  gruvboxDarkTheme,
  janusTheme,
  warpTheme,
  solsticeTheme,
  platinumTheme,
  workbenchTheme,
  horizonTheme,
};

test('splitter roles encode to valid colours at every depth in every preset', () => {
  for (const [name, theme] of Object.entries(PRESETS)) {
    for (const role of SPLIT_ROLES) {
      const { fg, bg } = (theme as unknown as Record<string, { fg: string; bg: string }>)[role];
      for (const depth of ALL_DEPTHS) {
        expect(() => encode(fg, 'fg', depth), `${name}.${role}.fg @ ${depth}`).not.toThrow();
        expect(() => encode(bg, 'bg', depth), `${name}.${role}.bg @ ${depth}`).not.toThrow();
      }
    }
  }
});
