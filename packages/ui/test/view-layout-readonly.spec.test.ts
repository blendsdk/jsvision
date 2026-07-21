/**
 * Specification tests (immutable oracles) — `View.layout` is read-only, and `setLayout` is the only
 * way to write it.
 *
 * Three contracts, two of which the compiler enforces and no runtime test can:
 *
 *   - the write happens **in place**, so the object a caller is holding stays the same object;
 *   - assigning the field, one of its props, or a field of a solved rect, is a **compile error**;
 *   - the same is true through a subclass that redeclares the field.
 *
 * That last one is not redundant. A subclass redeclaring `layout` without `readonly` silently
 * re-opens the field and the compiler says nothing — which is exactly how `Window` kept every
 * `win.layout.rect = …` in the desktop compiling through two earlier attempts at this lockdown. Ten
 * such redeclarations exist, so an oracle that only covered the base class would report a false
 * all-clear.
 *
 * The two type-level cases are written so the fixture compiles **only** while the errors are real:
 * an unused `@ts-expect-error` is `TS2578`, itself a hard compile error. They cannot rot into
 * passing-by-accident, and they cannot be satisfied by a runtime check, because `readonly` is erased
 * before anything runs.
 *
 * Expectations derive from the requirements, never the implementation. `.js` per NodeNext.
 */
import { test, expect } from 'vitest';
import { View } from '../src/view/index.js';
import { Window } from '../src/window/index.js';

/** Minimal concrete leaf view — only its layout props are under test. */
class Leaf extends View {
  draw(): void {
    // no-op — nothing here paints
  }
}

// ST-6 — the write is in place. Everything holding the object (a solved LayoutBox, a caller that
// stashed it) keeps seeing the current props rather than a detached snapshot of the old ones.
test('ST-6: setLayout mutates the layout object in place, preserving its identity', () => {
  const v = new Leaf();
  v.setLayout({ direction: 'col' });
  const before = v.layout;

  v.setLayout({ padding: 1 });

  expect(v.layout).toBe(before);
  expect(before).toEqual({ direction: 'col', padding: 1 });
});

// ST-7 — the field and its props are both closed on a plain view. Two separate holes: `readonly`
// alone would leave the object it hands back freely mutable, so the invariant would be advisory.
test('ST-7: neither the layout field nor its props accept a direct assignment', () => {
  const v = new Leaf();

  // @ts-expect-error the layout field is read-only — write through setLayout
  v.layout = { padding: 1 };
  // @ts-expect-error every prop is read-only too — a rect cannot be swapped in place
  v.layout.rect = { x: 0, y: 0, width: 1, height: 1 };

  v.setLayout({ rect: { x: 0, y: 0, width: 1, height: 1 } });
  const rect = v.layout.rect;
  if (rect === undefined) throw new Error('setLayout({ rect }) did not set a rect');
  // @ts-expect-error and the rect itself is read-only — no editing a solved rect a field at a time,
  // which would move the view without ever requesting a reflow
  rect.x = 5;

  // The assignments above are compile errors, not runtime ones: `readonly` is erased, so they do
  // execute. Asserting they took effect keeps this honest about what it does and does not prove.
  expect(v.layout.padding).toBe(1);
});

// ST-8 — the subclass escape hatch is shut. `Window` redeclares `layout` to seed its own defaults,
// which is precisely the shape that re-opened the field before.
test('ST-8: a subclass redeclaring layout does not re-open it', () => {
  const w = new Window('t');

  // @ts-expect-error Window redeclares the field, and it stays read-only through the override
  w.layout = { padding: 1 };
  // @ts-expect-error and its props stay read-only through the override too
  w.layout.rect = { x: 0, y: 0, width: 1, height: 1 };

  expect(w.layout.padding).toBe(1);
});
