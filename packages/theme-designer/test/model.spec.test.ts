/**
 * Specification tests (immutable oracles) — the pure `DesignerModel` state machine (ST-12…ST-21, ST-31).
 *
 * The model is two-mode: `roleSnapshot === null` ⇒ *derive* (theme generated from editable seeds +
 * alias overrides via `createTheme`); `roleSnapshot !== null` ⇒ *roles* (an opaque imported/literal
 * theme shown verbatim). The first alias/seed edit transitions roles→derive so the edit is visible.
 * These oracles pin that behavior plus role overrides (applied last), presets, contrast, depth,
 * serialize round-trip, import validation, and the dirty flag. A failing case means the model is wrong.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import {
  defaultTheme,
  nordTheme,
  draculaTheme,
  serializeTheme,
  parseTheme,
  InvalidThemeError,
  nearest256,
  nearest16,
  rgb256,
  toRgb,
  PALETTE,
} from '@jsvision/core';
import type { Theme } from '@jsvision/core';

import { createDesignerModel, contrastRows, depthSamples } from '../src/model/index.js';

/** The canonical CGA/DOS-16 correspondence (nearest16 slot index → Borland PALETTE key). */
const DOS16_BY_SLOT = [
  'black',
  'red',
  'green',
  'brown',
  'blue',
  'magenta',
  'cyan',
  'lightGray',
  'darkGray',
  'brightRed',
  'brightGreen',
  'yellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'white',
] as const;

/** `#rrggbb` for an Rgb (test-local, mirrors the model's serialization). */
function hex(rgb: { r: number; g: number; b: number }): string {
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

// ── ST-12: an alias edit re-drives the roles that use it; the model becomes dirty ──────────────────

test('ST-12: setAlias(accent) re-drives button.bg to the accent; dirty becomes true', () => {
  const m = createDesignerModel();
  m.setAlias('accent', '#3b82f6');
  expect(m.theme().button.bg, 'button.bg follows the accent alias').toBe('#3b82f6');
  expect(m.state().dirty, 'an edit sets dirty').toBe(true);
});

// ── ST-13: a role override is applied last — it survives a later alias edit ─────────────────────────

test('ST-13: setRole(button.bg) wins over a later setAlias(accent) (overrides applied last)', () => {
  const m = createDesignerModel();
  m.setRole('button', { bg: '#ff0000' });
  m.setAlias('accent', '#00ff00');
  expect(m.theme().button.bg, 'the role override is not masked by the alias').toBe('#ff0000');
});

// ── ST-14: clearing a role override reverts to the derived value ────────────────────────────────────

test('ST-14: clearRole reverts button.bg to its derived value', () => {
  const m = createDesignerModel();
  const derived = m.theme().button.bg; // the value before any override
  m.setRole('button', { bg: '#ff0000' });
  expect(m.theme().button.bg).toBe('#ff0000');
  m.clearRole('button');
  expect(m.theme().button.bg, 'reverts to the derived value').toBe(derived);
});

// ── ST-15: presets — a derived preset loads into derive mode; a literal into roles mode ────────────

test('ST-15: loadPreset(nord) → derive mode deep-equal to nordTheme; both dirty false', () => {
  const m = createDesignerModel();
  m.setAlias('accent', '#123456'); // make it dirty first
  m.loadPreset('nord');
  expect(m.state().roleSnapshot, 'a derived preset is in derive mode (no snapshot)').toBeNull();
  expect(m.theme(), 'theme deep-equals the shipped nord preset').toStrictEqual(nordTheme);
  expect(m.state().dirty, 'loadPreset clears dirty').toBe(false);
});

test('ST-15: loadPreset(turbo-vision) → roles mode (roleSnapshot = defaultTheme); dirty false', () => {
  const m = createDesignerModel();
  m.loadPreset('turbo-vision');
  expect(m.state().roleSnapshot, 'a literal preset is in roles mode (snapshot set)').not.toBeNull();
  expect(m.theme(), 'theme deep-equals the turbo-vision (default) theme').toStrictEqual(defaultTheme);
  expect(m.state().dirty).toBe(false);
});

// ── ST-16: contrast — low pairs flagged, 'default' pairs skipped (no NaN rows) ─────────────────────

test('ST-16: contrastRows flags a low-contrast pair as fail and skips a default-colored pair', () => {
  const lowContrast: Theme = { ...defaultTheme, menuBar: { ...defaultTheme.menuBar, fg: '#808080', bg: '#808080' } };
  const rowsLow = contrastRows(lowContrast);
  const menuRow = rowsLow.find((r) => r.pair === 'menuBar');
  expect(menuRow, 'the menuBar pair is present').toBeDefined();
  expect(menuRow?.level, 'a ~1:1 pair fails WCAG').toBe('fail');

  const withDefault: Theme = { ...defaultTheme, staticText: { fg: 'default', bg: defaultTheme.staticText.bg } };
  const rowsDefault = contrastRows(withDefault);
  expect(
    rowsDefault.find((r) => r.pair === 'staticText'),
    'a default-colored pair is skipped (contrastRatio is NaN)',
  ).toBeUndefined();
  // No row ever carries a NaN ratio.
  for (const r of rowsDefault) expect(Number.isFinite(r.ratio), `${r.pair} ratio is finite`).toBe(true);
});

// ── ST-17: depth — four samples with the downsampled hexes ─────────────────────────────────────────

test('ST-17: depthSamples yields truecolor/256/16/mono rows with the correct downsampled hexes', () => {
  const samples = depthSamples('#3b82f6');
  expect(samples.map((s) => s.depth)).toStrictEqual(['truecolor', '256', '16', 'mono']);
  const rgb = toRgb('#3b82f6')!;
  const byDepth = Object.fromEntries(samples.map((s) => [s.depth, s.hex]));
  expect(byDepth.truecolor, 'truecolor is the color as-is').toBe('#3b82f6');
  expect(byDepth['256'], '256 is rgb256(nearest256)').toBe(hex(rgb256(nearest256(rgb))));
  expect(byDepth['16'], '16 is the DOS-16 palette hex for the emitted slot').toBe(
    PALETTE[DOS16_BY_SLOT[nearest16(rgb)]],
  );
  expect(['#000000', '#ffffff'], 'mono is black or white').toContain(byDepth.mono);
});

// ── ST-18: serialize round-trip ────────────────────────────────────────────────────────────────────

test('ST-18: exportJson then parseTheme round-trips to a theme deep-equal to theme()', () => {
  const m = createDesignerModel();
  m.setAlias('accent', '#3b82f6');
  const json = m.exportJson();
  expect(parseTheme(json), 'the exported JSON parses back to the same theme').toStrictEqual(m.theme());
});

// ── ST-19: import — a valid theme enters roles mode, dirty false, theme deep-equals the file ────────

test('ST-19: importJson(valid) enters roles mode with the parsed theme; dirty false', () => {
  const m = createDesignerModel();
  m.importJson(serializeTheme(draculaTheme));
  expect(m.state().roleSnapshot, 'import sets the role snapshot').not.toBeNull();
  expect(m.theme(), 'theme deep-equals the imported file').toStrictEqual(draculaTheme);
  expect(m.state().dirty, 'a fresh import is not dirty').toBe(false);
});

// ── ST-20: import errors leave the model unchanged ─────────────────────────────────────────────────

test('ST-20: importJson(malformed / wrong role set) throws InvalidThemeError and does not mutate state', () => {
  const m = createDesignerModel();
  const before = m.theme();
  expect(() => m.importJson('{bad}')).toThrow(InvalidThemeError);
  expect(() => m.importJson('{"version":1,"roles":{}}')).toThrow(InvalidThemeError);
  expect(m.theme(), 'state is unchanged after a failed import').toStrictEqual(before);
});

// ── ST-21: dirty lifecycle ─────────────────────────────────────────────────────────────────────────

test('ST-21: edits set dirty; loadPreset / importJson / markSaved clear it', () => {
  const m = createDesignerModel();
  expect(m.state().dirty, 'a fresh model is clean').toBe(false);
  m.setAlias('accent', '#3b82f6');
  expect(m.state().dirty).toBe(true);
  m.markSaved();
  expect(m.state().dirty, 'markSaved clears dirty').toBe(false);
  m.setRole('button', { bg: '#ff0000' });
  expect(m.state().dirty).toBe(true);
  m.loadPreset('slate');
  expect(m.state().dirty, 'loadPreset clears dirty').toBe(false);
  m.setAlias('accent', '#00ff00'); // dirty again
  m.importJson(serializeTheme(nordTheme));
  expect(m.state().dirty, 'importJson clears dirty').toBe(false);
});

// ── ST-31: an alias edit after an import is visible (roles → derive transition) ─────────────────────

test('ST-31: after importJson(valid), setAlias(accent) transitions to derive mode and is visible', () => {
  const m = createDesignerModel();
  m.importJson(serializeTheme(nordTheme));
  expect(m.state().roleSnapshot, 'starts in roles mode').not.toBeNull();
  m.setAlias('accent', '#ff0000');
  expect(m.state().roleSnapshot, 'the first alias edit clears the snapshot (→ derive)').toBeNull();
  expect(m.theme().button.bg, 'the accent edit is visible, not masked by the import').toBe('#ff0000');
  expect(m.state().dirty, 'the edit sets dirty').toBe(true);
});
