/**
 * Specification tests for portable F1–F12 terminal encodings.
 *
 * These expectations describe the public byte-to-key contract independently of
 * the parser implementation. A failing assertion requires a decoder correction,
 * not a weaker oracle.
 */
import { expect, test } from 'vitest';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';
import type { KeyEvent } from '../src/engine/input/events.js';

const encoder = new TextEncoder();

interface ExpectedKey {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
}

/** Decode one complete byte sequence and assert that it produces one key. */
function decodeOne(sequence: string): KeyEvent {
  const result = decode(encoder.encode(sequence), createDecoderState());
  expect(result.events).toHaveLength(1);
  expect(result.queries).toHaveLength(0);
  expect(result.rest).toHaveLength(0);
  const event = result.events[0];
  if (event?.type !== 'key') {
    throw new Error('expected one key event');
  }
  return event;
}

/** Assert the named key and its supported modifier projection. */
function expectKey(sequence: string, expected: ExpectedKey): void {
  const event = decodeOne(sequence);
  expect(event).toMatchObject({
    type: 'key',
    key: expected.key,
    ctrl: expected.ctrl ?? false,
    alt: expected.alt ?? false,
    shift: expected.shift ?? false,
  });
}

const classicFunctionKeys: ReadonlyArray<readonly [string, string]> = [
  ['\x1bOP', 'f1'],
  ['\x1bOQ', 'f2'],
  ['\x1bOR', 'f3'],
  ['\x1bOS', 'f4'],
  ['\x1b[11~', 'f1'],
  ['\x1b[12~', 'f2'],
  ['\x1b[13~', 'f3'],
  ['\x1b[14~', 'f4'],
  ['\x1b[15~', 'f5'],
  ['\x1b[17~', 'f6'],
  ['\x1b[18~', 'f7'],
  ['\x1b[19~', 'f8'],
  ['\x1b[20~', 'f9'],
  ['\x1b[21~', 'f10'],
  ['\x1b[23~', 'f11'],
  ['\x1b[24~', 'f12'],
];

test('should preserve classic SS3 and numeric-tilde function keys', () => {
  for (const [sequence, key] of classicFunctionKeys) {
    expectKey(sequence, { key });
  }
});

test('should decode CSI final function keys with standard modifiers', () => {
  const cases: ReadonlyArray<readonly [string, ExpectedKey]> = [
    ['\x1b[P', { key: 'f1' }],
    ['\x1b[Q', { key: 'f2' }],
    ['\x1b[R', { key: 'f3' }],
    ['\x1b[S', { key: 'f4' }],
    ['\x1b[1;2P', { key: 'f1', shift: true }],
    ['\x1b[1;3Q', { key: 'f2', alt: true }],
    ['\x1b[1;5R', { key: 'f3', ctrl: true }],
    ['\x1b[1;6S', { key: 'f4', ctrl: true, shift: true }],
  ];
  for (const [sequence, expected] of cases) {
    expectKey(sequence, expected);
  }
});

test('should decode Linux-console function keys without printable leakage', () => {
  for (const [index, final] of ['A', 'B', 'C', 'D', 'E'].entries()) {
    expectKey(`\x1b[[${final}`, { key: `f${index + 1}` });
  }
});

test('should decode Kitty functional identifiers for F1 through F12', () => {
  for (let index = 0; index < 12; index += 1) {
    expectKey(`\x1b[${57364 + index}u`, { key: `f${index + 1}` });
  }
  expectKey('\x1b[57373;5u', { key: 'f10', ctrl: true });
});

test('should consume unsupported functional-key forms without emitting keys', () => {
  const invalid = [
    '\x1b[57376u',
    '\x1b[99999u',
    '\x1b[57364;0u',
    '\x1b[57364;9u',
    '\x1b[57364;2;3u',
    '\x1b[?57364u',
    '\x1b[57364:2u',
    '\x1b[[Z',
  ];
  for (const sequence of invalid) {
    const result = decode(encoder.encode(sequence), createDecoderState());
    expect(result.events, sequence).toHaveLength(0);
    expect(result.rest, sequence).toHaveLength(0);
  }
});

test('should decode each new accepted family across every chunk boundary', () => {
  const accepted: ReadonlyArray<readonly [string, ExpectedKey]> = [
    ['\x1b[1;6S', { key: 'f4', ctrl: true, shift: true }],
    ['\x1b[[E', { key: 'f5' }],
    ['\x1b[57373;5u', { key: 'f10', ctrl: true }],
  ];

  for (const [sequence, expected] of accepted) {
    const bytes = encoder.encode(sequence);
    for (let split = 1; split < bytes.length; split += 1) {
      const first = decode(bytes.subarray(0, split), createDecoderState());
      expect(first.events, `${sequence} split at ${split}`).toHaveLength(0);
      const second = decode(bytes.subarray(split), first.state);
      expect(second.events, `${sequence} split at ${split}`).toHaveLength(1);
      expect(second.rest, `${sequence} split at ${split}`).toHaveLength(0);
      const event = second.events[0];
      expect(event?.type).toBe('key');
      expect(event).toMatchObject({
        key: expected.key,
        ctrl: expected.ctrl ?? false,
        alt: expected.alt ?? false,
        shift: expected.shift ?? false,
      });
    }
  }
});
