/**
 * Implementation test — the mount path behind the story `at()` helper.
 *
 * The specification oracle assigns a host double directly, which pins the
 * `at() -> setLayout -> invalidateLayout -> host.markRelayout()` wiring but takes "mounted" as
 * given. This closes the other half: mount a view through a real render root, so the host is the
 * one production actually supplies, and check that placing it still asks for exactly one reflow.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createRenderRoot, createRoot, Group } from '@jsvision/ui';
import { at } from '../kitchen-sink/story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

test('placing a view that a render root has mounted requests one reflow from that root', () => {
  createRoot(() => {
    const root = new Group();
    const child = new Group();
    root.add(child);

    const rr = createRenderRoot({ width: 20, height: 5 }, { caps });
    rr.mount(root);

    // Mounting is what supplies the host; the spec oracle assumes this step rather than running it.
    expect(child.host).not.toBeNull();

    const host = child.host as { markRelayout: () => void };
    const original = host.markRelayout.bind(host);
    let relayouts = 0;
    host.markRelayout = (): void => {
      relayouts += 1;
      original();
    };

    at(child, 1, 1, 4, 2);

    expect(relayouts).toBe(1);
  });
});
