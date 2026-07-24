import { describe, expect, it } from 'vitest';

import { createDecoderState, decode } from '../src/engine/input/decoder.js';

describe('terminal Ctrl+/ decoding', () => {
  it('ST-07 decodes byte 0x1f as Ctrl+/ without admitting unrelated C0 controls', () => {
    const ctrlSlash = decode(Uint8Array.from([0x1f]), createDecoderState());

    expect(ctrlSlash.events).toEqual([
      {
        type: 'key',
        key: '/',
        ctrl: true,
        alt: false,
        shift: false,
      },
    ]);
    for (const byte of [0x00, 0x1c, 0x1d, 0x1e]) {
      const unrelated = decode(Uint8Array.from([byte]), createDecoderState());
      expect(unrelated.events, `C0 byte 0x${byte.toString(16)} remains dropped`).toEqual([]);
    }
  });
});
