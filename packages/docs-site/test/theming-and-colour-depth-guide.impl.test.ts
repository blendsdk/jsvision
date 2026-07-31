import {
  Attr,
  InvalidColorError,
  InvalidThemeError,
  classicTheme,
  createTheme,
  encode,
  encodeStyle,
  fallbackGlyph,
  monochromeTheme,
  parseTheme,
  resolveCapabilities,
  serializeTheme,
} from '@jsvision/core';
import type { ThemeOptions } from '@jsvision/core';
import { createRoot } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import depthDefinition from '../examples/guides/color-depth-fallbacks.js';
import rolesDefinition from '../examples/guides/theme-role-states.js';
import { ColourDepthPanel } from '../src/example-fixtures/theming-and-colour-depth/colour-depth-panel.js';
import { ThemeRoleStatesPanel } from '../src/example-fixtures/theming-and-colour-depth/theme-role-states-panel.js';
import { demoShell } from '../src/demo-shell.js';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  key,
  viewsIn,
} from './example-lab-harness.js';

/** Narrow parsed JSON to an object without bypassing the type system. */
function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected a JSON object');
  }
  return Object.fromEntries(Object.entries(value));
}

/** Return a mutable, freshly parsed valid theme envelope and its role map. */
function themeEnvelope(): { readonly envelope: Record<string, unknown>; readonly roles: Record<string, unknown> } {
  const envelope = recordOf(JSON.parse(serializeTheme(classicTheme)));
  const roles = recordOf(envelope.roles);
  envelope.roles = roles;
  return { envelope, roles };
}

describe('Theming & colour depth hardening', () => {
  test('should reject invalid generation seeds and incomplete or unsafe imported themes', () => {
    expect(() => createTheme({ mode: 'dark', accent: 'default' })).toThrow(InvalidColorError);
    expect(() => createTheme({ mode: 'dark', accent: '#3b82f6', neutral: 'default' })).toThrow(InvalidColorError);
    const directlyAssigned = ['accelerator', 'menuAccelerator', 'danger', 'warning', 'success', 'info'] as const;
    for (const seed of directlyAssigned) {
      const options: ThemeOptions = { mode: 'dark', accent: '#3b82f6', [seed]: 'default' };
      expect(() => createTheme(options)).not.toThrow();
    }

    const missing = themeEnvelope();
    delete missing.roles.button;
    expect(() => parseTheme(JSON.stringify(missing.envelope))).toThrow(InvalidThemeError);

    const unknown = themeEnvelope();
    unknown.roles.untrustedRole = { fg: '#ffffff', bg: '#000000' };
    expect(() => parseTheme(JSON.stringify(unknown.envelope))).toThrow(InvalidThemeError);

    const unsafe = themeEnvelope();
    const desktop = recordOf(unsafe.roles.desktop);
    desktop.pattern = '\u001b';
    unsafe.roles.desktop = desktop;
    expect(() => parseTheme(JSON.stringify(unsafe.envelope))).toThrow(InvalidThemeError);
  });

  test('should expose a palette collapse that is distinct at truecolor and identical at 16 colours', () => {
    const first = '#3b82f6';
    const second = '#3c83f7';
    expect(encode(first, 'fg', 'truecolor')).not.toBe(encode(second, 'fg', 'truecolor'));
    expect(encode(first, 'fg', '16')).toBe(encode(second, 'fg', '16'));
  });

  test('should preserve monochrome state with attributes while omitting every colour sequence', () => {
    const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'mono' } }).profile;
    const normal = monochromeTheme.listNormal;
    const focused = monochromeTheme.listFocused;
    const normalSgr = encodeStyle(normal.fg, normal.bg, normal.attrs ?? Attr.none, caps);
    const focusedSgr = encodeStyle(focused.fg, focused.bg, focused.attrs ?? Attr.none, caps);
    expect(normalSgr).toBe('');
    expect(focusedSgr).toContain('[7m');
    expect(focusedSgr).not.toMatch(/(?:38|48);(?:2|5)/u);
  });

  test('should provide deterministic ASCII substitutes for every fallback class used by the lab', () => {
    const caps = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: {
        unicode: { utf8: false },
        glyphs: { boxDrawing: false, halfBlocks: false, ambiguousWide: true },
      },
    }).profile;
    expect(fallbackGlyph('┌', caps)).toBe('+');
    expect(fallbackGlyph('─', caps)).toBe('-');
    expect(fallbackGlyph('█', caps)).toBe('#');
    expect(fallbackGlyph('×', caps)).toBe('x');
    expect(fallbackGlyph('A', caps)).toBe('A');
  });

  test('should keep repeated role and depth interactions deterministic and clean up exactly once', () => {
    createRoot((dispose) => {
      const roles = buildLabExample('guides/theme-role-states', rolesDefinition);
      const rolesPanel = viewsIn(roles.dialog).find(
        (view): view is ThemeRoleStatesPanel => view instanceof ThemeRoleStatesPanel,
      );
      if (rolesPanel === undefined) throw new Error('Missing role-state panel');
      roles.app.loop.dispatch(key('t', { alt: true }));
      roles.app.loop.dispatch(key('t', { alt: true }));
      roles.app.loop.dispatch(key('r', { alt: true }));
      roles.app.loop.dispatch(key('c', { alt: true }));
      expect(rolesPanel.themeSwitches).toBe(2);
      expect(rolesPanel.roleChecks).toBe(1);
      expect(rolesPanel.contrastChecks).toBe(1);
      roles.app.loop.dispose();
      expect(rolesPanel.cleanupCount).toBe(1);

      const depth = buildLabExample('guides/color-depth-fallbacks', depthDefinition);
      const depthPanel = viewsIn(depth.dialog).find(
        (view): view is ColourDepthPanel => view instanceof ColourDepthPanel,
      );
      if (depthPanel === undefined) throw new Error('Missing colour-depth panel');
      for (let index = 0; index < 8; index += 1) depth.app.loop.dispatch(key('d', { alt: true }));
      depth.app.loop.dispatch(key('a', { alt: true }));
      depth.app.loop.dispatch(key('a', { alt: true }));
      expect(depthPanel.depthChanges).toBe(8);
      expect(depthPanel.monochromeChecks).toBe(2);
      expect(depthPanel.asciiChecks).toBe(2);
      depth.app.loop.dispose();
      expect(depthPanel.cleanupCount).toBe(1);
      dispose();
    });
  });

  test('should notify host and app-owned theme observers without suppressing either one', () => {
    createRoot((dispose) => {
      const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
      let hostNotifications = 0;
      const app = demoShell({
        build: (ctx) => rolesDefinition.build(ctx),
        title: rolesDefinition.title,
        kind: 'app',
        themeMenu: true,
        caps,
        viewport: { width: 80, height: 24 },
        onThemeChange: () => {
          hostNotifications += 1;
        },
      });
      const rolesPanel =
        app.desktop === undefined
          ? undefined
          : viewsIn(app.desktop).find((view): view is ThemeRoleStatesPanel => view instanceof ThemeRoleStatesPanel);
      if (rolesPanel === undefined) throw new Error('Missing role-state panel');
      app.loop.resize({ width: 80, height: 24 });
      app.loop.emitCommand('demo.theme.3');
      expect(hostNotifications).toBe(1);
      expect(rolesPanel.currentThemeName).toBe('Nord');
      expect(rolesPanel.themeSwitches).toBe(1);
      app.loop.dispose();
      dispose();
    });
  });

  test.each([
    ['guides/theme-role-states', rolesDefinition],
    ['guides/color-depth-fallbacks', depthDefinition],
  ] as const)('should preserve %s through repeated resize, maximize, and restore', (id, definition) => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(id, definition, { viewport: { width: 120, height: 40 } });
      const compact = { ...dialog.bounds };
      for (let index = 0; index < 2; index += 1) {
        const origin = absoluteOrigin(dialog);
        const corner = {
          x: origin.x + dialog.bounds.width - 1,
          y: origin.y + dialog.bounds.height - 1,
        };
        dispatchExampleAction(app, {
          kind: 'mouse',
          gesture: 'drag',
          at: corner,
          to: { x: corner.x + 4, y: corner.y + 2 },
        });
      }
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      const resized = { ...dialog.bounds };
      dialog.zoom();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      expect(dialog.bounds.width).toBeGreaterThan(compact.width);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      app.loop.dispose();
      dispose();
    });
  });
});
