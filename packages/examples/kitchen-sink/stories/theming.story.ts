/**
 * Story: Theming (RD-22) — the built-in theme presets and the tiered theming model.
 *
 * Shows all 7 presets as palette swatch strips (each preset's window/button/focus/menu/status/input
 * colors drawn with explicit colors, so they read true regardless of the shell's own theme), plus a
 * couple of live widgets themed by the app. The live `demo:themes` designer cycles accent/mode/depth
 * and hot-swaps the theme at runtime.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import {
  classicTheme,
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
  type Theme,
} from '@jsvision/core';
import { Group, View, Text, Button, Input, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** The presets shown, in navigator order. */
const PRESETS: readonly [string, Theme][] = [
  ['turboVision', classicTheme],
  ['monochrome', monochromeTheme],
  ['slate', slateTheme],
  ['nord', nordTheme],
  ['dracula', draculaTheme],
  ['solarized', solarizedDarkTheme],
  ['gruvbox', gruvboxDarkTheme],
  ['janus', janusTheme],
  ['warp', warpTheme],
  ['solstice', solsticeTheme],
  ['platinum', platinumTheme],
  ['workbench', workbenchTheme],
  ['horizon', horizonTheme],
];

/** Draws one labelled swatch strip per preset using each preset's own colors (theme-independent). */
class PaletteView extends View {
  draw(ctx: DrawContext): void {
    PRESETS.forEach(([name, theme], y) => {
      ctx.text(0, y, name.padEnd(12), { fg: theme.staticText.fg, bg: theme.staticText.bg });
      let x = 13;
      const swatches = [theme.window, theme.button, theme.listFocused, theme.menuSelected, theme.statusBar];
      for (const role of swatches) {
        ctx.fillRect(x, y, 3, 1, ' ', { fg: role.fg, bg: role.bg });
        x += 3;
      }
      ctx.text(x + 1, y, ' Aa ', { fg: theme.button.fg, bg: theme.button.bg });
    });
  }
}

export const themingStory: Story = {
  id: 'theming/presets',
  category: 'Theming',
  title: 'Theme presets',
  rd: 'RD-22',
  blurb: '13 presets as palette swatches · createTheme → 18 aliases → 67 roles · serialize · setTheme hot-swap.',
  build(ctx: StoryContext) {
    const g = new Group();
    const swatchY = 2;
    const afterSwatches = swatchY + PRESETS.length + 1;
    g.add(
      at(
        new Text('The 13 built-in presets — swatches: window · button · focus · menu · status. Live: demo:themes.'),
        1,
        0,
        Math.max(10, ctx.width - 2),
        1,
      ),
    );
    g.add(at(new PaletteView(), 1, swatchY, Math.min(ctx.width - 2, 40), PRESETS.length));
    // Severity text roles: a danger-red error line and an amber advisory, painted via Text.severity and
    // driven by the theme's dangerText / warningText roles (they hot-swap with the theme).
    const sevY = swatchY + PRESETS.length; // the row just below the swatch strips
    g.add(at(new Text('✖ validation error', { severity: 'error' }), 1, sevY, 20, 1));
    g.add(at(new Text('▲ heads-up advisory', { severity: 'warning' }), 22, sevY, 20, 1));
    g.add(
      at(
        new Input({ value: signal('editable — themed by the app') }),
        1,
        afterSwatches,
        Math.min(30, ctx.width - 2),
        1,
      ),
    );
    g.add(at(new Button('~O~K', { onClick: () => {} }), 1, afterSwatches + 2, 8, 2));
    g.add(
      at(
        new Text('createTheme(seeds) → 18 aliases → 67 roles · serializeTheme/parseTheme · setTheme hot-swaps live.'),
        1,
        afterSwatches + 5,
        Math.max(10, ctx.width - 2),
        1,
      ),
    );
    return g;
  },
};
