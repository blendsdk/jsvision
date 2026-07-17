/**
 * Implementation test — the `layout/split` story's `g` grab-mark toggle wiring (ST-8, followups).
 *
 * The story root (`preProcess`) catches `g` before the focused splitter and flips `grabMark` on every
 * `SplitView` in the subtree, while the resize arrows still bubble to the splitter. This walks the
 * built tree, collects both SplitViews (outer row + nested col), and asserts a synthetic `g` flips
 * them all and back — and that a non-`g` key is left untouched (so arrows still resize).
 *
 * The tree is fully built at construction (no mount needed to flip a signal), so this asserts on the
 * built Group directly. The `.js` extension in import specifiers is required by NodeNext ESM.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, SplitView } from '@jsvision/ui';
import type { View, DispatchEvent } from '@jsvision/ui';
import { splitStory } from '../kitchen-sink/stories/split.story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Collect every `SplitView` in a subtree (depth-first). Only a `Group` has children to descend into. */
function collectSplitViews(v: View, out: SplitView[] = []): SplitView[] {
  if (v instanceof SplitView) out.push(v);
  if (v instanceof Group) for (const c of v.children) collectSplitViews(c, out);
  return out;
}

/** A full KeyEvent (all modifier flags present) so the envelope matches what the loop delivers. */
function keyEvent(key: string): KeyEvent {
  return { type: 'key', key, ctrl: false, alt: false, shift: false };
}

/** Feed a synthetic key envelope to a root's `onEvent` and report whether it was handled. */
function dispatchKey(root: Group, key: string): boolean {
  const ev: DispatchEvent = { event: keyEvent(key), handled: false };
  root.onEvent(ev);
  return ev.handled;
}

test('ST-8 (followups): `g` flips grabMark on every SplitView in the story and back; arrows are untouched', () => {
  const root = splitStory.build({ caps, width: 72, height: 16 });
  const splits = collectSplitViews(root);
  // The story is a nested grid: an outer row split whose 2nd pane is a col split.
  expect(splits.length, 'the story holds two SplitViews (outer + nested)').toBe(2);

  const before = splits.map((s) => s.grabMark.peek());
  expect(before, 'both start with the grab mark on (default true)').toEqual([true, true]);

  // A non-`g` key must not flip anything and must not be swallowed (so a focused splitter's arrows work).
  expect(dispatchKey(root, 'right'), 'a non-g key is left unhandled').toBe(false);
  expect(
    splits.map((s) => s.grabMark.peek()),
    'a non-g key leaves the grab mark unchanged',
  ).toEqual(before);

  // `g` flips every split's grab mark and is marked handled.
  expect(dispatchKey(root, 'g'), 'g is handled').toBe(true);
  expect(
    splits.map((s) => s.grabMark.peek()),
    'g flipped every split',
  ).toEqual(before.map((v) => !v));

  // A second `g` flips them back.
  expect(dispatchKey(root, 'g'), 'the second g is handled').toBe(true);
  expect(
    splits.map((s) => s.grabMark.peek()),
    'the second g restored every split',
  ).toEqual(before);
});
