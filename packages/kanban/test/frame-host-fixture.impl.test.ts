import { ScreenBuffer } from '@jsvision/core';
import { resolveCapabilities } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { createKanbanFrameHostFixture } from '../src/testing.js';

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const STYLE = Object.freeze({ fg: 'default' as const, bg: 'default' as const });

/** Creates one deterministic terminal buffer with optional visible content. */
function frame(width = 8, height = 3, text = ''): ScreenBuffer {
  const buffer = new ScreenBuffer(width, height, STYLE);
  if (text.length > 0) buffer.text(1, 1, text, STYLE);
  return buffer;
}

describe('Kanban frame-host testing fixture', () => {
  it('keeps an independent host baseline across correlated captures', () => {
    const host = createKanbanFrameHostFixture(CAPS);
    const first = frame();
    const second = frame(8, 3, 'A');
    const third = frame(8, 3, 'AB');

    const initial = host.capture('frame-1', first, second);
    const subsequent = host.capture('frame-2', second, third);

    expect(initial.operationId).toBe('frame-1');
    expect(initial.host).toEqual(initial.renderRoot);
    expect(subsequent.operationId).toBe('frame-2');
    expect(subsequent.host).toEqual(subsequent.renderRoot);
    expect(subsequent.renderRoot).toMatchObject({ changedCells: 1, changedRuns: 1 });
    host.dispose();
  });

  it('rejects invalid identities, mismatched geometry, and capture after disposal', () => {
    const host = createKanbanFrameHostFixture(CAPS);
    const before = frame();
    const after = frame(8, 3, 'A');

    expect(() => host.capture('../unsafe', before, after)).toThrow(RangeError);
    expect(() => host.capture('wrong-size', before, frame(9, 3))).toThrow('Frame sizes must match.');
    host.dispose();
    expect(() => host.capture('disposed', before, after)).toThrow(RangeError);
  });
});
