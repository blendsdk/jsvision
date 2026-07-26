/**
 * Defensive implementation coverage for Button-group option validation and ownership.
 */
import { expect, test } from 'vitest';
import { Button, buttonColumn, buttonGroup, Group, measureButtonGroup } from '../src/index.js';

test.each([
  ['minimumButtonWidth', { minimumButtonWidth: -1 }],
  ['minimumButtonWidth', { minimumButtonWidth: 1.5 }],
  ['gap', { gap: Number.POSITIVE_INFINITY }],
  ['rowGap', { rowGap: -1 }],
  ['maxColumns', { maxColumns: 0 }],
])('rejects an invalid %s cell option before composing', (_name, options) => {
  expect(() => measureButtonGroup([new Button('OK')], options)).toThrow(RangeError);
});

test('measures without assigning parents or layout bounds', () => {
  const button = new Button('Measure me');

  measureButtonGroup([button]);

  expect(button.parent).toBeNull();
  expect(button.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
});

test('rejects duplicate Button identity in one composition', () => {
  const button = new Button('Once');

  expect(() => buttonGroup([button, button])).toThrow(
    'Each Button must be unattached and occur only once in a Button group.',
  );
  expect(button.parent).toBeNull();
});

test('rejects a Button that already belongs to a live view tree', () => {
  const parent = new Group();
  const button = new Button('Attached');
  parent.add(button);

  expect(() => buttonGroup([button])).toThrow('Each Button must be unattached and occur only once in a Button group.');
  expect(button.parent).toBe(parent);
});

test('validates the vertical gap accepted by buttonColumn', () => {
  expect(() => buttonColumn([new Button('OK')], { gap: -1 })).toThrow(RangeError);
});
