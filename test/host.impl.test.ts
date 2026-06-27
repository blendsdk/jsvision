/**
 * Implementation tests — host internals & edges (RD-07).
 *
 * Unlike the spec suites, these probe internals and edge cases: per-capability
 * mode gating, the deferred keyboard protocol (DEF-2), and the strict-inverse
 * property under partial profiles. Later phases append orchestrator/lifecycle
 * sections to this file.
 *
 * Capabilities come from RD-02's `resolveCapabilities({ override })` with a clean
 * env so no real terminal is needed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { enterMode, leaveMode } from '../src/engine/host/modes.js';
import { createHost } from '../src/engine/host/host.js';
import { ScreenBuffer } from '../src/engine/render/buffer.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';
import type { InputEvent } from '../src/engine/input/events.js';
import { CaptureStream, FakeInput, FakeRuntimeAdapter } from './host-doubles.js';

/** Deterministic capability profile with the given fields overridden. */
function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

// ---------------------------------------------------------------------------
// Mode gating — each capability gate independently
// ---------------------------------------------------------------------------

test('modes: altScreen off omits ?1049', () => {
  const out = enterMode(caps({ altScreen: false }));
  assert.equal(out.includes('?1049'), false);
});

test('modes: mouse.sgr false omits all mouse modes', () => {
  const out = enterMode(caps({ mouse: { sgr: false, drag: true, wheel: true } }));
  assert.equal(out.includes('?1006'), false, 'no SGR encoding');
  assert.equal(out.includes('?1000'), false, 'no basic tracking');
  assert.equal(out.includes('?1002'), false, 'no button-event tracking');
});

test('modes: drag off keeps SGR+basic mouse but omits ?1002 (PF-003)', () => {
  const out = enterMode(caps({ mouse: { sgr: true, drag: false, wheel: true } }));
  assert.ok(out.includes('?1006h'), 'SGR encoding present');
  assert.ok(out.includes('?1000h'), 'basic tracking present');
  assert.equal(out.includes('?1002'), false, 'button-event (drag) omitted when drag is false');
});

test('modes: any-motion tracking ?1003 is never emitted (PF-003)', () => {
  const full = caps({ mouse: { sgr: true, drag: true, wheel: true } });
  assert.equal(enterMode(full).includes('?1003'), false);
  assert.equal(leaveMode(full).includes('?1003'), false);
});

test('modes: bracketedPaste false omits ?2004', () => {
  const out = enterMode(caps({ bracketedPaste: false }));
  assert.equal(out.includes('?2004'), false);
});

test('modes: colorDepth does not affect mode sequences', () => {
  const mono = enterMode(caps({ colorDepth: 'mono' }));
  const truecolor = enterMode(caps({ colorDepth: 'truecolor' }));
  assert.equal(mono, truecolor, 'mode setup is independent of color depth');
});

// ---------------------------------------------------------------------------
// Focus is host policy (PF-006), not caps-gated
// ---------------------------------------------------------------------------

test('modes: focus defaults on (?1004h present)', () => {
  assert.ok(enterMode(caps()).includes('?1004h'));
});

test('modes: focus:false omits ?1004h on enter and ?1004l on leave (PF-006)', () => {
  const profile = caps({ altScreen: true, bracketedPaste: true });
  assert.equal(enterMode(profile, { focus: false }).includes('?1004'), false);
  assert.equal(leaveMode(profile, { focus: false }).includes('?1004'), false);
});

// ---------------------------------------------------------------------------
// Keyboard protocol is deferred (DEF-2 / RT-1) — no CSI-u / modifyOtherKeys
// ---------------------------------------------------------------------------

test('modes: keyboard caps enabled still emit no keyboard-protocol bytes (DEF-2)', () => {
  const kb = caps({ keyboard: { kittyFlags: true, modifyOtherKeys: true } });
  const enter = enterMode(kb);
  const leave = leaveMode(kb);
  // No Kitty push/pop (CSI > … u / CSI < … u) and no modifyOtherKeys (CSI > 4 ; … m).
  assert.equal(/\x1b\[>\d*u/.test(enter), false, 'no Kitty push on enter');
  assert.equal(/\x1b\[<\d*u/.test(leave), false, 'no Kitty pop on leave');
  assert.equal(/\x1b\[>4;\d+m/.test(enter), false, 'no modifyOtherKeys on enter');
  assert.equal(/\x1b\[>4;\d+m/.test(leave), false, 'no modifyOtherKeys on leave');
});

// ---------------------------------------------------------------------------
// Strict-inverse property holds under partial profiles
// ---------------------------------------------------------------------------

test('modes: leave disables exactly the modes enter enabled (drag-off profile)', () => {
  const profile = caps({ mouse: { sgr: true, drag: false, wheel: true }, altScreen: true, bracketedPaste: true });
  const enter = enterMode(profile);
  const leave = leaveMode(profile);
  const enabled = [...enter.matchAll(/\?(\d+)h/g)].map((m) => m[1]);
  for (const mode of enabled) {
    assert.ok(leave.includes(`?${mode}l`), `leave disables ?${mode}`);
  }
  assert.equal(enabled.includes('1002'), false, 'drag mode 1002 not among enabled');
});

// ---------------------------------------------------------------------------
// Orchestrator — input pump, lifecycle, render edges (Phase 3)
// ---------------------------------------------------------------------------

/** A host wired to fresh doubles; returns the host plus its doubles for driving. */
function harness(overrides: Partial<Parameters<typeof createHost>[0]> = {}): {
  host: ReturnType<typeof createHost>;
  adapter: FakeRuntimeAdapter;
  input: FakeInput;
  output: CaptureStream;
  events: InputEvent[];
} {
  const adapter = new FakeRuntimeAdapter();
  const input = new FakeInput(true);
  const output = new CaptureStream();
  const events: InputEvent[] = [];
  const host = createHost({
    caps: caps({ altScreen: true }),
    runtime: adapter,
    input: input.asInput(),
    output: output.asOutput(),
    onInput: (e) => events.push(e),
    ...overrides,
  });
  return { host, adapter, input, output, events };
}

test('orchestrator: new bytes cancel the armed ESC timer (no spurious Escape)', async () => {
  const { host, adapter, input, events } = harness();
  await host.start();
  input.feed(Uint8Array.from([0x1b])); // arm the timer
  input.feed(Uint8Array.from([0x5b, 0x41])); // completes ESC [ A → up; cancels the timer
  adapter.advanceTimer(100); // timer was cleared — must fire nothing
  await host.stop();
  assert.deepEqual(events, [{ type: 'key', key: 'up', ctrl: false, alt: false, shift: false }]);
});

test('orchestrator: stop removes the data listener; later bytes are ignored', async () => {
  const { host, input, events } = harness();
  await host.start();
  assert.equal(input.listenerCount('data'), 1, 'one data listener while running');
  await host.stop();
  assert.equal(input.listenerCount('data'), 0, 'listener removed on stop');
  input.feed(Uint8Array.from([0x1b, 0x5b, 0x41]));
  assert.equal(events.length, 0, 'bytes after stop are not dispatched');
});

test('orchestrator: restart re-attaches exactly one listener (no leak across cycles)', async () => {
  const { host, input, events } = harness();
  await host.start();
  await host.stop();
  await host.start();
  assert.equal(input.listenerCount('data'), 1, 'no listener leak after a start/stop/start cycle');
  input.feed(Uint8Array.from([0x1b, 0x5b, 0x41]));
  await host.stop();
  assert.deepEqual(events, [{ type: 'key', key: 'up', ctrl: false, alt: false, shift: false }]);
});

test('orchestrator: an unchanged frame re-render writes nothing (empty diff)', async () => {
  const { host, output } = harness();
  await host.start();
  const a = new ScreenBuffer(8, 2, { fg: 'default', bg: 'default' });
  a.set(1, 0, 'Z', { fg: 'default', bg: 'default' });
  host.render(a);
  const afterFirst = output.data.length;
  const b = new ScreenBuffer(8, 2, { fg: 'default', bg: 'default' });
  b.set(1, 0, 'Z', { fg: 'default', bg: 'default' });
  host.render(b); // identical content → empty diff → no write
  await host.stop();
  assert.equal(output.data.length, afterFirst + leaveMode(caps({ altScreen: true })).length, 'second render wrote nothing (only leave-mode follows)');
});

test('orchestrator: render before start is a no-op (no throw, no write)', () => {
  const { host, output } = harness();
  const buf = new ScreenBuffer(4, 1, { fg: 'default', bg: 'default' });
  assert.doesNotThrow(() => host.render(buf));
  assert.equal(output.data, '', 'nothing written before start');
});
