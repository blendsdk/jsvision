/**
 * Implementation tests — the opt-in input diagnostics report.
 *
 * Covers the pure pieces of the `JSVISION_INPUT_DIAG` troubleshooting aid: the
 * output-path resolver and the report builder. The report is the ground truth
 * for why input does or does not work on a given host (notably a Windows
 * double-click), so these tests pin what it captures and that it never leaks
 * arbitrary environment values.
 */
import { test, expect } from 'vitest';

import { resolveInputDiagPath, collectInputDiagnostics } from '../src/engine/host/diagnostics.js';
import type { InputDiagSnapshot } from '../src/engine/host/diagnostics.js';
import { resolveCapabilities } from '../src/engine/capability/index.js';

const win32Caps = resolveCapabilities({ env: {}, platform: 'win32' }).profile;

function snapshot(overrides: Partial<InputDiagSnapshot> = {}): InputDiagSnapshot {
  return {
    env: {},
    platform: 'win32',
    runtime: 'bun 1.1.0',
    inputIsTTY: false,
    outputIsTTY: true,
    hostIsTTY: false,
    hasSetRawMode: true,
    isRaw: false,
    caps: win32Caps,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveInputDiagPath — the flag gate + output path
// ---------------------------------------------------------------------------

test('resolveInputDiagPath: unset flag disables the diagnostic', () => {
  expect(resolveInputDiagPath({})).toBe(null);
});

test('resolveInputDiagPath: a bare truthy flag resolves the default file', () => {
  const path = resolveInputDiagPath({ JSVISION_INPUT_DIAG: '1' });
  expect(path).not.toBe(null);
  expect(path).toContain('jsvision-input-diag');
});

test('resolveInputDiagPath: an explicit path value is used verbatim', () => {
  expect(resolveInputDiagPath({ JSVISION_INPUT_DIAG: '/tmp/my-diag.txt' })).toBe('/tmp/my-diag.txt');
});

// ---------------------------------------------------------------------------
// collectInputDiagnostics — the report captures the decisive facts
// ---------------------------------------------------------------------------

test('the report captures runtime, platform, streams, raw-mode state, and caps', () => {
  const report = collectInputDiagnostics(snapshot());

  expect(report).toContain('runtime: bun 1.1.0');
  expect(report).toContain('platform: win32');
  // The decisive input facts: does jsvision see a TTY, and did raw mode engage?
  expect(report).toContain('stdin.isTTY: false');
  expect(report).toContain('stdin.setRawMode present: true');
  expect(report).toContain('stdin.isRaw: false');
  // A caps summary so a rendering fallback shows up in the same report.
  expect(report).toContain('colorDepth: truecolor');
  expect(report).toContain('glyphs.boxDrawing: true');
  expect(report).toContain('mouse.sgr: true');
});

test('the report reads WT_SESSION as a set/unset flag, not its value', () => {
  const unset = collectInputDiagnostics(snapshot({ env: {} }));
  expect(unset).toContain('WT_SESSION: unset');

  const set = collectInputDiagnostics(snapshot({ env: { WT_SESSION: 'abc-123-guid' } }));
  expect(set).toContain('WT_SESSION: set');
  // The session id is a value we do not echo back.
  expect(set).not.toContain('abc-123-guid');
});

test('the report never echoes arbitrary environment values', () => {
  // Only a curated allowlist of terminal-related keys is reported; an unrelated
  // secret in the environment must never appear in the diagnostic file.
  const report = collectInputDiagnostics(snapshot({ env: { MY_SECRET_TOKEN: 'super-secret-value' } }));
  expect(report).not.toContain('super-secret-value');
  expect(report).not.toContain('MY_SECRET_TOKEN');
});

test('the report surfaces the known terminal keys when present', () => {
  const report = collectInputDiagnostics(snapshot({ env: { TERM: 'xterm-256color', TERM_PROGRAM: 'vscode' } }));
  expect(report).toContain('TERM: xterm-256color');
  expect(report).toContain('TERM_PROGRAM: vscode');
});
