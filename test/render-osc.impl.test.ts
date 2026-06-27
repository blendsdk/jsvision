/**
 * Implementation tests — OSC feature edge cases (RD-04, plan doc 03-04).
 *
 * Unsupported-capability degradation, notify-ladder priority when several flags
 * are set, multibyte base64, and the bell. Complements the ST-6/7/10/12 oracles.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { hyperlink, setClipboard, setTitle, bell, notify } from '../src/engine/render/osc.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { CapabilityProfile, DeepPartial } from '../src/engine/capability/index.js';

function caps(override: DeepPartial<CapabilityProfile> = {}): CapabilityProfile {
  return resolveCapabilities({ env: {}, platform: 'linux', override }).profile;
}

test('hyperlink without support returns sanitized plain text (no escape)', () => {
  const out = hyperlink('click', 'http://x', caps({ osc: { hyperlink8: false } }));
  assert.equal(out, 'click');
});

test('setClipboard without support returns empty string', () => {
  assert.equal(setClipboard('hi', caps({ osc: { clipboard52: false } })), '');
});

test('setTitle without support returns empty string', () => {
  assert.equal(setTitle('My App', caps({ osc: { title: false } })), '');
});

test('bell is a single BEL byte', () => {
  assert.equal(bell(), '\x07');
  assert.equal(bell().length, 1);
});

test('notify ladder: OSC 99 wins when every flag is set', () => {
  const all = caps({
    osc: { notify99: true, notify9: true, notify777: true, progress9_4: true },
  });
  assert.ok(notify('t', 'b', all).startsWith('\x1b]99;'));
});

test('notify ladder: OSC 9 wins over 777 and progress when 99 is off', () => {
  const c = caps({
    osc: { notify99: false, notify9: true, notify777: true, progress9_4: true },
  });
  assert.ok(notify('t', 'b', c).startsWith('\x1b]9;'));
});

test('notify ladder: progress 9;4 is used when only it is available', () => {
  const c = caps({
    osc: { notify99: false, notify9: false, notify777: false, progress9_4: true },
  });
  assert.equal(notify('t', 'b', c), '\x1b]9;4;1;0\x07');
});

test('setClipboard base64-encodes multibyte UTF-8 correctly', () => {
  const out = setClipboard('世界', caps({ osc: { clipboard52: true } }));
  const payload = out.slice('\x1b]52;c;'.length, out.length - 1);
  assert.equal(Buffer.from(payload, 'base64').toString('utf8'), '世界');
});
