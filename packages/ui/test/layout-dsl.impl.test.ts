/**
 * Implementation tests — the declarative builders' edge cases (written after the spec is green):
 * the `Flex` size-shorthand precedence matrix, a zero-weight spacer, variadic children without a
 * props object, and that `grow`/`fixed` preserve a view's other layout props.
 */
import { test, expect } from 'vitest';
import { View, Group } from '../src/view/index.js';
import { col, row, grow, fixed, spacer } from '../src/view/index.js';

class Leaf extends View {
  draw(): void {}
}

// The size shorthands resolve in a fixed order: explicit `size` > `fixed` > `grow` > `fill` > none.
test('Flex precedence: fixed > grow > fill; none → undefined size', () => {
  expect(col({ fixed: 5, grow: 3, fill: true }).layout.size).toEqual({ kind: 'fixed', cells: 5 });
  expect(col({ grow: 3, fill: true }).layout.size).toEqual({ kind: 'fr', weight: 3 });
  expect(col({ fill: true }).layout.size).toEqual({ kind: 'fr', weight: 1 });
  expect(col({}).layout.size).toBeUndefined();
  // Explicit `size` beats every shorthand, including `fixed`.
  expect(col({ size: { kind: 'fr', weight: 2 }, fixed: 5 }).layout.size).toEqual({ kind: 'fr', weight: 2 });
});

// Non-size Flex props pass straight through to the group's layout, and `background` is pulled out.
test('Flex passes through justify/gap/padding; background is not a layout key', () => {
  const g = col({ gap: 2, justify: 'center', padding: 1, background: 'window' });
  expect(g.layout.gap).toBe(2);
  expect(g.layout.justify).toBe('center');
  expect(g.layout.padding).toBe(1);
  expect(g.layout.direction).toBe('col');
  expect(g.background).toBe('window');
  expect('background' in g.layout).toBe(false);
});

// A zero-weight spacer is a valid flex child that absorbs no space.
test('spacer(0) → fr weight 0 (absorbs no leftover space)', () => {
  expect(spacer(0).layout.size).toEqual({ kind: 'fr', weight: 0 });
  expect(spacer().layout.size).toEqual({ kind: 'fr', weight: 1 }); // default weight 1
});

// Variadic children with no leading props object: every argument is a child.
test('col(a, b, c) with no props → Group of [a, b, c], direction col', () => {
  const a = new Leaf();
  const b = new Leaf();
  const c = new Leaf();
  const g = col(a, b, c);
  expect(g).toBeInstanceOf(Group);
  expect(g.children).toEqual([a, b, c]);
  expect(g.layout.direction).toBe('col');
  // A bare row with a single child works too.
  expect(row(a).children).toEqual([a]);
});

// grow/fixed merge onto existing layout props rather than replacing them.
test("grow/fixed preserve a view's other layout props", () => {
  const v = new Leaf();
  v.layout = { padding: 1, justify: 'end' };
  grow(v, 2);
  expect(v.layout).toEqual({ padding: 1, justify: 'end', size: { kind: 'fr', weight: 2 } });
  fixed(v, 7);
  expect(v.layout).toEqual({ padding: 1, justify: 'end', size: { kind: 'fixed', cells: 7 } });
});
