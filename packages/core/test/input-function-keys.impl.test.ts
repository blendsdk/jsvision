/**
 * Hardening tests for function-key grammar boundaries and chunked decoding.
 */
import { expect, test } from 'vitest';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';
import type { InputEvent } from '../src/engine/input/events.js';

const encoder = new TextEncoder();

/** Decode a complete sequence and return all emitted input events. */
function decodeEvents(sequence: string): readonly InputEvent[] {
  const result = decode(encoder.encode(sequence), createDecoderState());
  expect(result.rest, sequence).toHaveLength(0);
  return result.events;
}

test('should reject malformed CSI function-key parameter grammar', () => {
  const malformed = [
    '\x1b[1;;2P',
    '\x1b[1;P',
    '\x1b[;2P',
    '\x1b[1:2P',
    '\x1b[?1;2P',
    '\x1b[1;2 P',
    '\x1b[1;2;3P',
    '\x1b[57364;;2u',
    '\x1b[57364;u',
    '\x1b[;2u',
    '\x1b[57364:2u',
    '\x1b[?57364;2u',
    '\x1b[57364;2 u',
    '\x1b[57364;2;3u',
    `\x1b[${'9'.repeat(32)}u`,
  ];

  for (const sequence of malformed) {
    expect(decodeEvents(sequence), sequence).toHaveLength(0);
  }
});

test('should enforce family-specific modifier boundaries', () => {
  const accepted = [
    ['\x1b[1;1P', { key: 'f1', ctrl: false, alt: false, shift: false }],
    ['\x1b[1;16P', { key: 'f1', ctrl: true, alt: true, shift: true }],
    ['\x1b[11;16~', { key: 'f1', ctrl: true, alt: true, shift: true }],
    ['\x1b[57364;1u', { key: 'f1', ctrl: false, alt: false, shift: false }],
    ['\x1b[57364;8u', { key: 'f1', ctrl: true, alt: true, shift: true }],
  ] as const;
  for (const [sequence, expected] of accepted) {
    expect(decodeEvents(sequence), sequence).toStrictEqual([{ type: 'key', ...expected }]);
  }

  for (const sequence of ['\x1b[1;0P', '\x1b[1;17P', '\x1b[11;0~', '\x1b[11;17~', '\x1b[57364;0u', '\x1b[57364;9u']) {
    expect(decodeEvents(sequence), sequence).toHaveLength(0);
  }
});

test('should reject unknown function identifiers and Linux finals', () => {
  for (const sequence of ['\x1b[57363u', '\x1b[57376u', '\x1b[99999u', '\x1b[[F', '\x1b[[Z']) {
    expect(decodeEvents(sequence), sequence).toHaveLength(0);
  }
});

test('should preserve unrelated legacy CSI behavior', () => {
  expect(decodeEvents('\x1b[1;17C')).toStrictEqual([
    { type: 'key', key: 'right', ctrl: false, alt: false, shift: false },
  ]);
  expect(decodeEvents('\x1b[3;17~')).toStrictEqual([
    { type: 'key', key: 'delete', ctrl: false, alt: false, shift: false },
  ]);
});

test('should decode accepted function-key sequences at every split point', () => {
  const accepted = ['\x1b[P', '\x1b[1;16S', '\x1b[[A', '\x1b[[E', '\x1b[57364u', '\x1b[57375;8u'];

  for (const sequence of accepted) {
    const bytes = encoder.encode(sequence);
    const contiguous = decode(bytes, createDecoderState());
    expect(contiguous.events, sequence).toHaveLength(1);
    for (let split = 1; split < bytes.length; split += 1) {
      const first = decode(bytes.subarray(0, split), createDecoderState());
      expect(first.events, `${sequence} split ${split} first`).toHaveLength(0);
      const second = decode(bytes.subarray(split), first.state);
      expect(second.events, `${sequence} split ${split} second`).toStrictEqual(contiguous.events);
      expect(second.rest, `${sequence} split ${split} rest`).toHaveLength(0);
    }
  }
});
