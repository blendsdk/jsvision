/**
 * A full Turbo Vision-style desktop application: a menu bar, a status line, a
 * window manager, and two framed windows — the same @jsvision/ui app you would
 * write for a real terminal, running unchanged in the browser. Press F10 for the
 * menu, drag a title bar to move a window, drag a corner to resize, F5 / F4 to
 * cascade / tile, F6 for the next window, and Tab to cycle focus.
 */
import { Window, View } from '@jsvision/ui';
import type { Size2D, DrawContext } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

/**
 * A window-content panel: it fills the framed interior with the `window` theme
 * role and draws its lines. Unlike a bare `Text`, it claims the full available
 * interior (via `measure`), so the background fill covers the whole panel.
 */
class PanelView extends View {
  constructor(private readonly lines: readonly string[]) {
    super();
  }

  /** Claim the whole window interior so the background fill covers it. */
  override measure(available: Size2D): Size2D {
    return available;
  }

  override draw(ctx: DrawContext): void {
    const role = ctx.role('window');
    const style = { fg: role.fg, bg: role.bg };
    ctx.fill(' ', style);
    for (let y = 0; y < ctx.size.height && y < this.lines.length; y += 1) {
      const line = this.lines[y];
      if (line !== undefined && line !== '') ctx.text(0, y, line, style);
    }
  }
}

/** Two-space-indented rows render inside the info panel. */
const WELCOME_LINES = [
  'JSVision, in your browser.',
  '',
  'This whole desktop is the terminal',
  'SDK rendering to xterm.js — the same',
  'engine, unchanged, over a browser host.',
];

const TIPS_LINES = [
  '',
  '  F10      menu bar',
  '  drag     move a window',
  '  corner   resize a window',
  '  F5 / F4  cascade / tile',
  '  F6       next window',
  '  Tab      cycle focus',
];

export default defineExample({
  title: 'Turbo Vision desktop',
  blurb: 'A full windowing app — menu bar, status line, movable/resizable windows — running in the browser.',
  build: (ctx) => {
    // The shared chrome supplies the System/View menu, the Window menu, the status line, and the
    // About / Theme / Depth commands — the same menu every example shows (Theme/Depth work here too).
    const app = demoApp(ctx, { windowMenu: true });
    app.desktop.shadow = true; // Turbo Vision drop-shadows under the windows.

    const welcome = new Window('Welcome');
    welcome.number = 1;
    welcome.setLayout({ rect: { x: 1, y: 1, width: 42, height: 12 } });
    welcome.add(new PanelView(WELCOME_LINES));
    app.desktop.addWindow(welcome);

    const tips = new Window('Tips');
    tips.number = 2;
    tips.setLayout({ rect: { x: 46, y: 3, width: 30, height: 10 } });
    tips.add(new PanelView(TIPS_LINES));
    app.desktop.addWindow(tips);

    return app;
  },
});
