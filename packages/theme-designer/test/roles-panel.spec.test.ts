/**
 * Specification test (immutable oracle) — the roles rail's alias annotation.
 *
 * After the accelerator decouple, `danger`/`warning` remain in the alias vocabulary but drive no
 * built-in role, so the rail marks them "(reserved)" to prevent the "I edited danger and nothing
 * happened" confusion. The two new accelerator aliases appear as ordinary, selectable rail rows. A
 * failing case means the annotation is missing/misapplied or a new alias row is absent.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { createDesignerModel } from '../src/model/index.js';
import { aliasRailLabel, buildRolesPanel } from '../src/view/roles-panel.js';

test('reserved aliases carry a "(reserved)" label; the accelerators and other aliases do not', () => {
  expect(aliasRailLabel('danger'), 'danger is app-reserved').toContain('(reserved)');
  expect(aliasRailLabel('warning'), 'warning is app-reserved').toContain('(reserved)');
  expect(aliasRailLabel('accelerator'), 'accelerator drives control hotkeys').not.toContain('(reserved)');
  expect(aliasRailLabel('menuAccelerator'), 'menuAccelerator drives chrome hotkeys').not.toContain('(reserved)');
  expect(aliasRailLabel('accent'), 'accent drives roles').not.toContain('(reserved)');
});

test('the rail exposes the two accelerator alias targets, with raw (unsuffixed) names', () => {
  const { targets } = buildRolesPanel(createDesignerModel());
  expect(targets, 'accelerator is a selectable alias row').toContainEqual({ kind: 'alias', name: 'accelerator' });
  expect(targets, 'menuAccelerator is a selectable alias row').toContainEqual({
    kind: 'alias',
    name: 'menuAccelerator',
  });
  // The "(reserved)" suffix is display-only — the selection target keeps the raw alias name.
  expect(targets, 'danger target name is unsuffixed').toContainEqual({ kind: 'alias', name: 'danger' });
  expect(targets, 'warning target name is unsuffixed').toContainEqual({ kind: 'alias', name: 'warning' });
});
