/**
 * Implementation tests (edge cases / internals) — RD-14 Phase-0 additive seams.
 *
 * Companion to `dropdown.seams.spec.test.ts`; covers the seam internals the oracle does not: the
 * imperative overlay derive counts children (not child *visibility*), is idempotent, and the promoted
 * public `Input.selectAll` keeps its existing internal-caller behaviour (select-all vs. collapse).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { View, Group } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { syncOverlayVisible } from '../src/app/index.js';

class Leaf extends View {
  draw(_ctx: DrawContext): void {}
}

// ── Overlay derive edge cases (PF-001) ──────────────────────────────────────────────────────────

test('syncOverlayVisible counts children, not their visibility (an invisible child still shows the overlay)', () => {
  const overlay = new Group();
  const hidden = new Leaf();
  hidden.state.visible = false; // a mounted-but-invisible child still counts
  overlay.add(hidden);

  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(true); // children.length > 0 is the rule, regardless of child visibility
});

test('syncOverlayVisible is idempotent — repeat calls with no child change do not flip the flag', () => {
  const overlay = new Group();
  overlay.add(new Leaf());
  syncOverlayVisible(overlay);
  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(true);

  overlay.remove(overlay.children[0]);
  syncOverlayVisible(overlay);
  syncOverlayVisible(overlay);
  expect(overlay.state.visible).toBe(false);
});

// ── Input seam existing-caller safety (PA-8) ────────────────────────────────────────────────────

test('getValueSignal returns the live two-way signal — external writes are visible through it', () => {
  const value = signal('one');
  const input = new Input({ value });
  const sig = input.getValueSignal();
  sig.set('two');
  expect(value()).toBe('two'); // the seam hands back the SAME signal, not a copy
});

test('public selectAll preserves internal-caller behaviour: true selects the whole field, false collapses', () => {
  const input = new Input({ value: signal('hello') });

  input.selectAll(true);
  expect(input.selection).toStrictEqual({ start: 0, end: 5 });
  expect(input.caretPos).toBe(5);

  input.selectAll(false);
  expect(input.selection).toStrictEqual({ start: 0, end: 0 });
  expect(input.caretPos).toBe(0);
});

test('public selectAll defaults to selecting the whole field (enable defaults to true)', () => {
  const input = new Input({ value: signal('abcd') });
  input.selectAll(); // no arg — History calls it this way after a pick
  expect(input.selection).toStrictEqual({ start: 0, end: 4 });
});
