/**
 * Implementation tests for the deep-link parser: `?example=<id>` opens that
 * example, an unknown id is a no-op, and a no-keyboard device never opens a
 * terminal (it shows the fallback instead).
 */
import { test, expect } from 'vitest';
import { deepLinkTarget, parseDeepLink } from '../src/play/deep-link.js';

const IDS = ['controls/button', 'files/file-dialog'];

test('parseDeepLink matches a known example id', () => {
  expect(parseDeepLink('?example=controls/button', IDS)).toBe('controls/button');
});

test('parseDeepLink is a no-op for an unknown id or a missing param', () => {
  expect(parseDeepLink('?example=nope', IDS)).toBeNull();
  expect(parseDeepLink('?foo=bar', IDS)).toBeNull();
  expect(parseDeepLink('', IDS)).toBeNull();
});

test('deepLinkTarget opens a matched example only on a keyboard-capable device', () => {
  expect(deepLinkTarget('?example=controls/button', IDS, false)).toBe('controls/button');
  // No-keyboard: the deep link shows the fallback, it never opens a terminal.
  expect(deepLinkTarget('?example=controls/button', IDS, true)).toBeNull();
  expect(deepLinkTarget('?example=nope', IDS, false)).toBeNull();
});
