/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming (ST-13…ST-20).
 *
 * Source: RD-22 AC-8, AC-9 → ST-13…ST-20 (plans/theming/07-testing-strategy.md; 03-03-attrs-and-serialize.md;
 * ambiguity registers AR-281, AR-282, PA-5). Covers the lossless, injection-safe serialize/parse
 * round-trip and the field-kind validation matrix — a hostile payload never yields a partial theme.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  serializeTheme,
  parseTheme,
  InvalidThemeError,
  defaultTheme,
  createTheme,
  Attr,
  type Theme,
} from '../src/engine/index.js';

/** A theme exercising every serialized field kind: pattern, hotkey, attrs, and structural extras. */
const attrsTheme: Theme = {
  ...defaultTheme,
  menuBar: { ...defaultTheme.menuBar, attrs: Attr.bold | Attr.underline },
  statusBar: { ...defaultTheme.statusBar, attrs: Attr.dim },
};

/** Parse a serialized theme back to a mutable plain object for corruption tests. */
function serializedObject(theme: Theme): Record<string, unknown> {
  return JSON.parse(serializeTheme(theme)) as Record<string, unknown>;
}

// ── ST-13: lossless round-trip ─────────────────────────────────────────────────────────────────────

test('ST-13: parseTheme ∘ serializeTheme is identity on default, generated, and attr themes', () => {
  for (const theme of [defaultTheme, createTheme({ mode: 'dark', accent: '#3b82f6' }), attrsTheme]) {
    expect(parseTheme(serializeTheme(theme)), 'round-trips deep-equal').toStrictEqual(theme);
  }
  // The desktop pattern glyph survives verbatim.
  expect(parseTheme(serializeTheme(defaultTheme)).desktop.pattern, 'pattern preserved').toBe(
    defaultTheme.desktop.pattern,
  );
});

// ── ST-14: envelope shape + stable key order ───────────────────────────────────────────────────────

test('ST-14: serializeTheme emits a { version: 1, roles: {…} } envelope with canonical role order', () => {
  const parsed = JSON.parse(serializeTheme(defaultTheme)) as { version: number; roles: Record<string, unknown> };
  expect(parsed.version, 'version 1').toBe(1);
  expect(typeof parsed.roles, 'roles is an object').toBe('object');
  expect(Object.keys(parsed.roles), 'role order matches defaultTheme').toStrictEqual(Object.keys(defaultTheme));
});

// ── ST-15 / ST-16: malformed colors in a field or an extra ─────────────────────────────────────────

test('ST-15: a malformed color in a fg/bg field is rejected with no partial theme', () => {
  const obj = serializedObject(defaultTheme);
  (obj.roles as Record<string, Record<string, string>>).desktop.fg = '#zz0000';
  expect(() => parseTheme(JSON.stringify(obj)), 'bad color rejected').toThrow(InvalidThemeError);
});

test('ST-16: a malformed color in a structural extra (window.border) is rejected', () => {
  const obj = serializedObject(defaultTheme);
  (obj.roles as Record<string, Record<string, string>>).window.border = '#zz0000';
  expect(() => parseTheme(JSON.stringify(obj)), 'bad extra color rejected').toThrow(InvalidThemeError);
});

// ── ST-17: pattern must be a single printable cell ─────────────────────────────────────────────────

test('ST-17: a non-single-cell desktop.pattern is rejected', () => {
  const badPatterns = ['', 'ab', '漢', '\t', '\n', '\x1b[31m', '\x07'];
  for (const pattern of badPatterns) {
    const obj = serializedObject(defaultTheme);
    (obj.roles as Record<string, Record<string, string>>).desktop.pattern = pattern;
    expect(() => parseTheme(JSON.stringify(obj)), `pattern ${JSON.stringify(pattern)} rejected`).toThrow(
      InvalidThemeError,
    );
  }
});

// ── ST-18: attrs must be an in-range integer ───────────────────────────────────────────────────────

test('ST-18: an out-of-range or non-integer attrs is rejected', () => {
  for (const attrs of [999, -1, 1.5, Number.NaN]) {
    const obj = serializedObject(attrsTheme);
    (obj.roles as Record<string, Record<string, unknown>>).menuBar.attrs = attrs;
    expect(() => parseTheme(JSON.stringify(obj)), `attrs ${attrs} rejected`).toThrow(InvalidThemeError);
  }
});

// ── ST-19: role-set + per-role shape ───────────────────────────────────────────────────────────────

test('ST-19: a missing role, an unknown role, or a wrong-shape role is rejected', () => {
  const missing = serializedObject(defaultTheme);
  delete (missing.roles as Record<string, unknown>).button;
  expect(() => parseTheme(JSON.stringify(missing)), 'missing role').toThrow(InvalidThemeError);

  const unknown = serializedObject(defaultTheme);
  (unknown.roles as Record<string, unknown>).bogusRole = { fg: '#fff', bg: '#000' };
  expect(() => parseTheme(JSON.stringify(unknown)), 'unknown role').toThrow(InvalidThemeError);

  const wrongShape = serializedObject(defaultTheme);
  (wrongShape.roles as Record<string, Record<string, string>>).historyWindow.title = '#ffffff';
  expect(() => parseTheme(JSON.stringify(wrongShape)), 'historyWindow with a title').toThrow(InvalidThemeError);
});

// ── ST-20: structural / versioning rejects ─────────────────────────────────────────────────────────

test('ST-20: non-JSON input and an unknown version are rejected', () => {
  expect(() => parseTheme('not json at all'), 'non-JSON').toThrow(InvalidThemeError);
  expect(() => parseTheme('{"version":2,"roles":{}}'), 'version 2, no migration in v1').toThrow(InvalidThemeError);
  expect(() => parseTheme('[]'), 'array top level').toThrow(InvalidThemeError);
  expect(() => parseTheme('null'), 'null top level').toThrow(InvalidThemeError);
});
