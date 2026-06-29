/**
 * Implementation tests — ScreenBuffer.clone() internals & edges (07 §impl).
 *
 * Clone of an empty (freshly-filled) buffer, clone after box()/shadow(), and full
 * independence under subsequent set() on either copy. Covers the RD-03 partial-recompose
 * snapshot contract (PA-8 / AR-44) beyond the ST-22 spec oracle.
 */
import { test, expect } from 'vitest';
import { ScreenBuffer, serialize, resolveCapabilities } from '../src/engine/index.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;
const OPTS = { caps };

test('clone of a freshly-filled (empty) buffer equals the original', () => {
  const buf = new ScreenBuffer(5, 3, { fg: 'default', bg: 'default' });
  const clone = buf.clone();
  expect(clone.width).toBe(5);
  expect(clone.height).toBe(3);
  expect(serialize(clone, buf, OPTS)).toBe(''); // identical → empty diff
});

test('clone after box() and shadow() reproduces every cell exactly', () => {
  const buf = new ScreenBuffer(10, 6, { fg: 'default', bg: 'default' });
  buf.box(0, 0, 6, 4, { fg: 'white', bg: 'blue' }, 'single', 'Hi');
  buf.shadow(1, 4, 6, 1, { fg: 'white', bg: 'black' });
  const clone = buf.clone();
  expect(serialize(clone, buf, OPTS)).toBe(''); // border + title + shadow cells all match
});

test('mutating either copy after clone never affects the other (independence)', () => {
  const buf = new ScreenBuffer(4, 2, { fg: 'default', bg: 'default' });
  buf.text(0, 0, 'AB', { fg: 'red', bg: 'default' });
  const clone = buf.clone();

  // Mutate the original → the clone is untouched.
  buf.set(0, 0, 'X', { fg: 'green', bg: 'default' });
  expect(clone.get(0, 0)?.char).toBe('A');

  // Mutate the clone → the original is untouched.
  clone.set(1, 1, 'Y', { fg: 'blue', bg: 'default' });
  expect(buf.get(1, 1)?.char).toBe(' ');
});
