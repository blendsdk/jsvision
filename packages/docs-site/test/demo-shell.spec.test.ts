/**
 * Specification test (immutable oracle) — the demo shell that wraps every
 * example into a mountable application with two chrome modes.
 *
 *  - **minimal** centers a single component and exposes Theme / Depth / About on
 *    a compact status line, with no menu bar.
 *  - **full** shows a menu bar (a system menu with About + a View menu offering
 *    Theme and Depth) plus a status line.
 *  - A theme switch repaints live (via the app's `setTheme`) with no re-mount,
 *    and the default open theme is Turbo Vision.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, turboVisionTheme, nordTheme } from '@jsvision/core';
import type { DrawContext } from '@jsvision/ui';
import { View, createRoot } from '@jsvision/ui';
import { demoShell } from '../src/demo-shell.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const VP = { width: 80, height: 24 };

/** A guaranteed-painting content view: fills its bounds and draws a marker label at its top-left. */
class Marker extends View {
  constructor(private readonly label: string) {
    super();
  }
  override draw(ctx: DrawContext): void {
    const role = ctx.role('window');
    const style = { fg: role.fg, bg: role.bg };
    ctx.fill(' ', style);
    ctx.text(0, 0, this.label, style);
  }
}

/** A sized content view (an example's `build()` returns something like this). */
function content(label = 'DEMOBODY', w = 24, h = 4): Marker {
  const m = new Marker(label);
  m.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  return m;
}

/** The composed frame as an array of row strings. */
function rowsOf(app: { loop: { renderRoot: { buffer(): { rows(): readonly { char: string }[][] } } } }): string[] {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((r) => r.map((c) => c.char).join(''));
}

/** A colour-aware signature of the whole frame (char + fg + bg + attrs per cell). */
function signatureOf(app: {
  loop: {
    renderRoot: { buffer(): { rows(): readonly { char: string; fg: unknown; bg: unknown; attrs: unknown }[][] } };
  };
}): string {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((r) => r.map((c) => `${c.char}:${String(c.fg)}:${String(c.bg)}:${String(c.attrs)}`).join('|'))
    .join('\n');
}

test('ST-4: minimal chrome centers the component with a compact Theme/Depth/About status and no menu bar', () => {
  createRoot((dispose) => {
    const app = demoShell({ content: content('CENTERME', 20, 3), caps, viewport: VP, chrome: 'minimal' });
    const rows = rowsOf(app);
    const status = rows[rows.length - 1];
    expect(status).toContain('Theme');
    expect(status).toContain('Depth');
    expect(status).toContain('About');
    // No menu bar in minimal mode.
    expect(rows[0]).not.toContain('≡');
    // The component sits in the interior (centered), not on the top edge or the status row.
    const markerRow = rows.findIndex((r) => r.includes('CENTERME'));
    expect(markerRow).toBeGreaterThan(0);
    expect(markerRow).toBeLessThan(rows.length - 1);
    dispose();
  });
});

test('ST-5: full chrome shows a menu bar (≡ / View) and a status line', () => {
  createRoot((dispose) => {
    const app = demoShell({ content: content(), caps, viewport: VP, chrome: 'full' });
    const rows = rowsOf(app);
    // Menu bar on the top row: the system menu (≡) and the View menu.
    expect(rows[0]).toContain('≡');
    expect(rows[0]).toContain('View');
    // A status line on the bottom row.
    expect(rows[rows.length - 1].trim().length).toBeGreaterThan(0);
    dispose();
  });
});

test('ST-9: the default open theme is Turbo Vision and setTheme repaints live without a re-mount', () => {
  createRoot((dispose) => {
    const dflt = demoShell({ content: content(), caps, viewport: VP, chrome: 'full' });
    const tv = demoShell({ content: content(), caps, viewport: VP, chrome: 'full', theme: turboVisionTheme });
    // Default (no theme option) renders identically to an explicit Turbo Vision theme.
    expect(signatureOf(dflt)).toEqual(signatureOf(tv));

    const before = signatureOf(dflt);
    dflt.setTheme(nordTheme);
    const after = signatureOf(dflt);
    // The same app repainted in the new preset's colours — a live swap, not a rebuild.
    expect(after).not.toEqual(before);
    dispose();
  });
});
