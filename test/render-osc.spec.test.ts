/**
 * Specification tests — OSC features, notify ladder & cursor (RD-04, AC-5, M7).
 *
 * Immutable oracle: expectations derive from RD-04's acceptance criteria and
 * ST-6, ST-10, ST-12 in plan doc 07-testing-strategy (PL-8, PL-11, PL-12) —
 * never from reading the implementation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { notify, setClipboard, cursor } from '../src/engine/render/osc.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

/** A profile with the whole notify ladder off (BEL fallback). */
const NO_NOTIFY = caps({
  osc: { notify99: false, notify9: false, notify777: false, progress9_4: false },
});

// ---------------------------------------------------------------------------
// ST-6 — notify() capability ladder (AC-5)
// ---------------------------------------------------------------------------

test('ST-6: Kitty (notify99) → OSC 99', () => {
  const out = notify('t', 'b', caps({ osc: { notify99: true } }));
  assert.ok(out.startsWith('\x1b]99;'), `expected OSC 99, got ${JSON.stringify(out)}`);
});

test('ST-6: iTerm2 (notify9, no 99) → OSC 9', () => {
  const out = notify('t', 'b', caps({ osc: { notify99: false, notify9: true } }));
  assert.ok(out.startsWith('\x1b]9;'), `expected OSC 9, got ${JSON.stringify(out)}`);
});

test('ST-6: urxvt (notify777, no 99/9) → OSC 777', () => {
  const out = notify('t', 'b', caps({ osc: { notify99: false, notify9: false, notify777: true } }));
  assert.ok(out.startsWith('\x1b]777;'), `expected OSC 777, got ${JSON.stringify(out)}`);
});

test('ST-6: no notification support → exactly one BEL byte', () => {
  const out = notify('t', 'b', NO_NOTIFY);
  assert.equal(out, '\x07', 'BEL fallback is a single byte');
});

// ---------------------------------------------------------------------------
// ST-10 — cursor control (M7)
// ---------------------------------------------------------------------------

test('ST-10: cursor.hide / show / to produce the exact sequences', () => {
  assert.equal(cursor.hide(), '\x1b[?25l');
  assert.equal(cursor.show(), '\x1b[?25h');
  assert.equal(cursor.to(3, 6), '\x1b[3;6H');
});

// ---------------------------------------------------------------------------
// ST-12 — clipboard base64 of sanitized text (PL-12)
// ---------------------------------------------------------------------------

test('ST-12: setClipboard base64-encodes the sanitized text (OSC 52)', () => {
  const out = setClipboard('hi', caps({ osc: { clipboard52: true } }));
  assert.equal(out, '\x1b]52;c;aGk=\x07', 'base64("hi") === "aGk="');

  // The payload between ;c; and BEL is valid base64 decoding to the input.
  const payload = out.slice('\x1b]52;c;'.length, out.length - 1);
  assert.equal(Buffer.from(payload, 'base64').toString('utf8'), 'hi');
});
