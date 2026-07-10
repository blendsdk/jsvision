/**
 * Implementation tests for the demo shell's About/Theme/Depth wiring.
 *
 *  - The About command opens a dialog showing the site name + version.
 *  - The Depth command only *signals* intent via `onDepthChange` — DemoShell
 *    never mutates the (readonly) caps; a depth change is a re-mount decision the
 *    Play layer owns.
 *  - `SITE_META.version` is injected from the monorepo root package.json.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { DrawContext } from '@jsvision/ui';
import { View, createRoot } from '@jsvision/ui';
import { demoShell } from '../src/demo-shell.js';
import { SITE_META } from '../src/site-meta.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const VP = { width: 80, height: 24 };

class Marker extends View {
  override draw(ctx: DrawContext): void {
    const role = ctx.role('window');
    ctx.fill(' ', { fg: role.fg, bg: role.bg });
  }
}
function content(): Marker {
  const m = new Marker();
  m.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 24, height: 4 } };
  return m;
}
function frameText(app: { loop: { renderRoot: { buffer(): { rows(): readonly { char: string }[][] } } } }): string {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((r) => r.map((c) => c.char).join(''))
    .join('\n');
}

test('the About command opens a dialog showing the site name and version', () => {
  createRoot((dispose) => {
    const app = demoShell({ build: () => content(), title: 'Demo', kind: 'component', caps, viewport: VP });
    app.loop.emitCommand('demo.about');
    const text = frameText(app);
    expect(text).toContain(SITE_META.name);
    expect(text).toContain(SITE_META.version);
    dispose();
  });
});

test('the Depth command signals onDepthChange and never mutates caps', () => {
  createRoot((dispose) => {
    let got: string | undefined;
    const app = demoShell({
      build: () => content(),
      title: 'Demo',
      kind: 'component',
      caps,
      viewport: VP,
      onDepthChange: (d) => {
        got = d;
      },
    });
    app.loop.emitCommand('demo.depth.16');
    expect(got).toBe('16');
    // DemoShell only signals intent — caps is untouched (a live swap is a Play-layer re-mount).
    expect(caps.colorDepth).toBe('truecolor');
    dispose();
  });
});

test('SITE_META.version matches the monorepo root package.json version', () => {
  const rootPkg = JSON.parse(
    readFileSync(fileURLToPath(new URL('../../../package.json', import.meta.url)), 'utf8'),
  ) as { version: string };
  expect(SITE_META.version).toBe(rootPkg.version);
});
