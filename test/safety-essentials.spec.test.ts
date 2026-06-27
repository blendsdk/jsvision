/**
 * Specification tests — the essentials gate & errors (RD-08).
 *
 * Immutable oracle: expectations derive from RD-08 AC-1/AC-2 and the AR-1/AR-2/
 * AR-7/AR-8 decisions via ST-1…ST-8 in plan doc 07-testing-strategy — never from
 * reading the implementation. The single runtime essential is an interactive TTY;
 * missing mouse/color/alt-screen degrade (the SDK still starts) rather than stop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluateEssentials,
  essentialsMet,
  assertEssentials,
  EssentialsNotMetError,
  TuiError,
  createLogger,
} from '../src/engine/safety/index.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';
import type { DeepPartial, CapabilityProfile } from '../src/engine/capability/index.js';

/** Build a capability profile with the given overrides (real RD-02 resolution). */
function caps(override: DeepPartial<CapabilityProfile>): CapabilityProfile {
  return resolveCapabilities({ override }).profile;
}

const FULL = caps({ mouse: { sgr: true }, colorDepth: 'truecolor', altScreen: true });
const NO_MOUSE = caps({ mouse: { sgr: false }, colorDepth: 'truecolor', altScreen: true });
const MONO = caps({ mouse: { sgr: true }, colorDepth: 'mono', altScreen: true });
const NO_ALT = caps({ mouse: { sgr: true }, colorDepth: 'truecolor', altScreen: false });

// ST-1 — a non-interactive terminal is refused (AC-1).
test('ST-1: assertEssentials throws EssentialsNotMetError on a non-TTY', () => {
  assert.throws(
    () => assertEssentials(FULL, { isTTY: false }),
    (err) => {
      assert.ok(err instanceof EssentialsNotMetError);
      assert.ok(err instanceof TuiError);
      assert.ok(
        err.missing.some((m) => m.includes('interactive TTY')),
        'missing names the interactive TTY',
      );
      return true;
    },
  );
});

// ST-2 — missing mouse degrades to keyboard-only; does not throw (AC-2).
test('ST-2: missing mouse → met:true with a keyboard-only degradation', () => {
  const report = evaluateEssentials(NO_MOUSE, { isTTY: true });
  assert.equal(report.met, true);
  assert.deepEqual(report.missing, []);
  assert.equal(report.degradations.length, 1);
  assert.equal(report.degradations[0].cap, 'mouse');
  assert.equal(report.degradations[0].mode, 'keyboard-only');
});

// ST-3 — mono color degrades to monochrome (AC-2).
test('ST-3: mono colorDepth → met:true with a monochrome degradation', () => {
  const report = evaluateEssentials(MONO, { isTTY: true });
  assert.equal(report.met, true);
  assert.ok(report.degradations.some((d) => d.cap === 'color' && d.mode === 'monochrome'));
});

// ST-4 — no alt-screen degrades to inline (AC-2).
test('ST-4: no altScreen → met:true with an inline degradation', () => {
  const report = evaluateEssentials(NO_ALT, { isTTY: true });
  assert.equal(report.met, true);
  assert.ok(report.degradations.some((d) => d.cap === 'altScreen' && d.mode === 'inline'));
});

// ST-5 — full caps on a TTY → met, no missing, no degradations (AC-2).
test('ST-5: full caps → met:true with no missing and no degradations', () => {
  const report = evaluateEssentials(FULL, { isTTY: true });
  assert.deepEqual(report, { met: true, missing: [], degradations: [] });
});

// ST-6 — essentialsMet mirrors evaluateEssentials(...).met (AR-8).
test('ST-6: essentialsMet is true on a TTY and false on a non-TTY', () => {
  assert.equal(essentialsMet(FULL, { isTTY: true }), true);
  assert.equal(essentialsMet(FULL, { isTTY: false }), false);
});

// ST-7 — assertEssentials logs each degradation once at the gate component (AC-2).
test('ST-7: assertEssentials writes exactly one gate log entry per degradation', () => {
  const ring = createLogger({ sink: 'ring' });
  const report = assertEssentials(NO_MOUSE, { isTTY: true }, { logger: ring });
  assert.equal(report.met, true);
  const entries = ring.entries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].component, 'gate');
});

// ST-8 — the error message names the missing essential and the error is named (AC-1).
test('ST-8: EssentialsNotMetError message contains the missing essential', () => {
  const err = new EssentialsNotMetError(['interactive TTY']);
  assert.match(err.message, /interactive TTY/);
  assert.equal(err.name, 'EssentialsNotMetError');
});
