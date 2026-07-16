/**
 * Specification test (immutable oracle) — the roles rail's alias annotation.
 *
 * `danger`/`warning` now drive the `dangerText`/`warningText` roles (editing either alias re-colours
 * its role), so they are no longer "(reserved)": the rail marks no alias reserved today. The
 * accelerator aliases (and every other alias) appear as ordinary, selectable rail rows. A failing case
 * means an alias is wrongly flagged reserved or a selectable alias row is absent.
 *
 * This revises the earlier premise (danger/warning "drive no built-in role") because the requirement
 * that made it true has changed — a sanctioned oracle-follows-requirement update, not a rewrite for
 * convenience.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { createDesignerModel } from '../src/model/index.js';
import { aliasRailLabel, buildRolesPanel } from '../src/view/roles-panel.js';

test('no alias carries a "(reserved)" label — danger/warning now drive roles', () => {
  expect(aliasRailLabel('danger'), 'danger drives the dangerText role').not.toContain('(reserved)');
  expect(aliasRailLabel('warning'), 'warning drives the warningText role').not.toContain('(reserved)');
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
  // danger/warning stay selectable alias rows (they drive roles now, so they are ordinary, unsuffixed).
  expect(targets, 'danger is a selectable alias row').toContainEqual({ kind: 'alias', name: 'danger' });
  expect(targets, 'warning is a selectable alias row').toContainEqual({ kind: 'alias', name: 'warning' });
});
