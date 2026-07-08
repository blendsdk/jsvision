/**
 * Implementation tests — `DesignerModel` internals & edges.
 *
 * Covers the `roleSnapshot` lifecycle across the roles↔derive transition, user role edits surviving
 * that transition as `roleOverrides`, light/dark derivation, preset↔dirty edges, `resolvedAliases` in
 * both modes, `colorOf`, and the no-op edges (`clearRole` on an absent role, `select`/`setDepth` not
 * dirtying). The `.js` extension is required by NodeNext resolution.
 */
import { test, expect } from 'vitest';
import { aliasesFromSeeds } from '@jsvision/core';

import { createDesignerModel } from '../src/model/index.js';

test('roleSnapshot lifecycle: null → set by a literal preset → cleared by the first alias edit', () => {
  const m = createDesignerModel();
  expect(m.state().roleSnapshot, 'fresh model is in derive mode').toBeNull();
  m.loadPreset('turbo-vision');
  expect(m.state().roleSnapshot, 'a literal preset enters roles mode').not.toBeNull();
  m.setAlias('accent', '#abcdef');
  expect(m.state().roleSnapshot, 'the first alias edit returns to derive mode').toBeNull();
});

test('a role edit in roles mode survives the roles→derive transition (applied last)', () => {
  const m = createDesignerModel();
  m.loadPreset('turbo-vision'); // roles mode
  m.setRole('button', { bg: '#ff0000' }); // role edit while in roles mode
  expect(m.theme().button.bg).toBe('#ff0000');
  m.setAlias('accent', '#00ff00'); // transition to derive
  expect(m.state().roleSnapshot, 'now derive mode').toBeNull();
  expect(m.theme().button.bg, 'the role override survives the transition').toBe('#ff0000');
});

test('a role edit does NOT clear the snapshot (it applies over the imported theme)', () => {
  const m = createDesignerModel();
  m.loadPreset('turbo-vision');
  m.setRole('menuBar', { fg: '#123456' });
  expect(m.state().roleSnapshot, 'a role edit stays in roles mode').not.toBeNull();
  expect(m.theme().menuBar.fg).toBe('#123456');
});

test('light vs dark derivation produces different surfaces', () => {
  const m = createDesignerModel(); // dark by default
  const darkBg = m.theme().desktop.bg;
  m.setMode('light');
  expect(m.theme().desktop.bg, 'light mode yields a different desktop background').not.toBe(darkBg);
  expect(m.state().seeds.mode).toBe('light');
});

test('resolvedAliases reflects overrides in derive mode and the seed preview in roles mode', () => {
  const m = createDesignerModel();
  m.setAlias('accent', '#ff0000');
  expect(m.resolvedAliases().accent, 'derive mode: reflects the override').toBe('#ff0000');
  m.loadPreset('turbo-vision'); // roles mode; resets aliasOverrides
  expect(m.resolvedAliases().accent, 'roles mode: previews the seed-derived accent').toBe(
    aliasesFromSeeds(m.state().seeds).accent,
  );
});

test('colorOf returns the alias color for an alias target and the role bg for a role target', () => {
  const m = createDesignerModel();
  m.setAlias('accent', '#3b82f6');
  expect(m.colorOf({ kind: 'alias', name: 'accent' })).toBe('#3b82f6');
  expect(m.colorOf({ kind: 'role', name: 'button' }), 'role target → its background').toBe(m.theme().button.bg);
});

test('preset ↔ dirty: loadPreset clears, an edit dirties, reset clears', () => {
  const m = createDesignerModel();
  m.setAlias('accent', '#3b82f6');
  expect(m.state().dirty).toBe(true);
  m.loadPreset('dracula');
  expect(m.state().dirty).toBe(false);
  m.setRole('button', { bg: '#000000' });
  expect(m.state().dirty).toBe(true);
  m.reset();
  expect(m.state().dirty, 'reset clears dirty').toBe(false);
  expect(m.state().roleSnapshot, 'reset returns to derive mode').toBeNull();
});

test('no-op edges: clearRole on an absent role, select and setDepth do not dirty', () => {
  const m = createDesignerModel();
  m.clearRole('button'); // nothing to clear
  expect(m.state().dirty, 'clearRole on an absent role is a no-op').toBe(false);
  m.select({ kind: 'role', name: 'menuBar' });
  expect(m.state().selected).toStrictEqual({ kind: 'role', name: 'menuBar' });
  expect(m.state().dirty, 'select does not dirty').toBe(false);
  m.setDepth('16');
  expect(m.state().depth).toBe('16');
  expect(m.state().dirty, 'a depth change is a view pref, not a theme edit').toBe(false);
});
