/**
 * Specification test (immutable oracle) — the unified demo shell.
 *
 * Every live example runs inside ONE consistent chrome: a desktop with a menu
 * bar (System ▸ About, View ▸ Theme/Depth, and a Window menu for windowing
 * apps) and a hints-only status line. A `component` example is wrapped in a
 * titled, non-closable `Window` on the desktop (its cells sit on the window
 * surface, not the desktop pattern); an `app` example brings its own desktop
 * content and only has the shared commands wired onto it. A theme switch
 * repaints live (via `setTheme`) with no re-mount; the default theme is Turbo
 * Vision.
 *
 * (Supersedes the retired two-chrome-mode oracle: the old ST-4 "minimal chrome,
 * no menu bar, Theme/Depth in the status line" no longer describes the shell.)
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, classicTheme, nordTheme } from '@jsvision/core';
import type { DrawContext } from '@jsvision/ui';
import { View, Window, createRoot } from '@jsvision/ui';
import { demoShell } from '../src/demo-shell.js';
import desktopExample from '../examples/apps/desktop.js';

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

/** A sized content view — a component example's `build()` returns something like this. */
function marker(label = 'DEMOBODY'): Marker {
  return new Marker(label);
}

/** The composed frame as an array of row strings. */
function rowsOf(app: { loop: { renderRoot: { buffer(): { rows(): readonly { char: string }[][] } } } }): string[] {
  return app.loop.renderRoot
    .buffer()
    .rows()
    .map((r) => r.map((c) => c.char).join(''));
}

/** A per-cell char accessor over the composed frame. */
function cellCharAt(
  app: { loop: { renderRoot: { buffer(): { get(x: number, y: number): { char: string } | undefined } } } },
  x: number,
  y: number,
): string | undefined {
  return app.loop.renderRoot.buffer().get(x, y)?.char;
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

/** The stage windows the shell placed on the desktop (public `children`, filtered to `Window`). */
function stageWindows(app: { desktop: { children: readonly View[] } }): Window[] {
  return app.desktop.children.filter((c): c is Window => c instanceof Window);
}

test('ST-B1: a component example is wrapped in a titled, non-closable Window on the desktop', () => {
  createRoot((dispose) => {
    const app = demoShell({ build: () => marker(), title: 'Widget Demo', kind: 'component', caps, viewport: VP });
    const wins = stageWindows(app);
    expect(wins.length).toBe(1);
    expect(wins[0].closable).toBe(false); // a demo can never vanish to an empty desktop
    expect(wins[0].title()).toBe('Widget Demo'); // titled with the example title
    dispose();
  });
});

test('ST-B2: a component demo renders on the window surface, not the desktop pattern', () => {
  createRoot((dispose) => {
    const app = demoShell({ build: () => marker(), title: 'Widget Demo', kind: 'component', caps, viewport: VP });
    const pattern = classicTheme.desktop.pattern; // ░ — tiled across the desktop background
    // Dead-centre sits inside the near-full-desktop stage window → the window's clean interior surface.
    expect(cellCharAt(app, Math.floor(VP.width / 2), Math.floor(VP.height / 2))).not.toBe(pattern);
    // The desktop still patterns its margin left of the inset window — proving the sample discriminates.
    expect(cellCharAt(app, 0, Math.floor(VP.height / 2))).toBe(pattern);
    dispose();
  });
});

test('ST-B3: the desktop app carries the shared menu + a reachable Theme control', () => {
  createRoot((dispose) => {
    const app = demoShell({
      build: (ctx) => desktopExample.build(ctx),
      title: desktopExample.title,
      kind: 'app',
      caps,
      viewport: VP,
    });
    const menuRow = rowsOf(app)[0];
    expect(menuRow).toContain('View'); // the shared View menu (Theme/Depth)
    expect(menuRow).toContain('Window'); // the Window menu (windowMenu app)
    // Theme is now reachable (the #6 unreachable-handler defect is gone): emitting a preset repaints.
    const before = signatureOf(app);
    app.loop.emitCommand('demo.theme.3'); // a non-default preset (Nord)
    expect(signatureOf(app)).not.toEqual(before);
    dispose();
  });
});

test('ST-B4: the status line carries hint items only — no Theme/Depth primary control', () => {
  createRoot((dispose) => {
    const app = demoShell({ build: () => marker(), title: 'Widget Demo', kind: 'component', caps, viewport: VP });
    const status = rowsOf(app).at(-1) ?? '';
    // Theme/Depth are primary controls in the View menu now, not footer items (#5).
    expect(status).not.toContain('Theme');
    expect(status).not.toContain('Depth');
    // It is still a real hint row (About / Menu affordances).
    expect(status.trim().length).toBeGreaterThan(0);
    dispose();
  });
});

test('ST-B6: an in-app Exit emits quit, which the shell forwards to the host-close callback', () => {
  createRoot((dispose) => {
    let closed = 0;
    const app = demoShell({
      build: () => marker(),
      title: 'Widget Demo',
      kind: 'component',
      caps,
      viewport: VP,
      onClose: () => {
        closed += 1;
      },
    });
    // The System ▸ Exit item emits Commands.quit; the shell forwards it to the injected host-close
    // callback so the terminal app can dismiss its own Play modal (the × button is no longer the only way out).
    app.loop.emitCommand('quit');
    expect(closed).toBe(1);
    dispose();
  });
});

test('ST-5: the shell shows the shared menu bar (≡ / View) and a status line', () => {
  createRoot((dispose) => {
    const app = demoShell({ build: () => marker(), title: 'Widget Demo', kind: 'component', caps, viewport: VP });
    const rows = rowsOf(app);
    expect(rows[0]).toContain('≡'); // the System menu
    expect(rows[0]).toContain('View'); // the View menu
    expect((rows.at(-1) ?? '').trim().length).toBeGreaterThan(0); // a status line
    dispose();
  });
});

test('ST-9: the default theme is Turbo Vision and setTheme repaints live without a re-mount', () => {
  createRoot((dispose) => {
    const opts = { build: () => marker(), title: 'Widget Demo', kind: 'component' as const, caps, viewport: VP };
    const dflt = demoShell(opts);
    const tv = demoShell({ ...opts, theme: classicTheme });
    // Default (no theme option) renders identically to an explicit Turbo Vision theme.
    expect(signatureOf(dflt)).toEqual(signatureOf(tv));

    const before = signatureOf(dflt);
    dflt.setTheme(nordTheme);
    // The same app repainted in the new preset's colours — a live swap, not a rebuild.
    expect(signatureOf(dflt)).not.toEqual(before);
    dispose();
  });
});
