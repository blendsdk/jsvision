/**
 * Specification tests (immutable oracles) — RD-08 Phase-2 EOL policy (ST-5).
 *
 * Source: RD-08 AC-15 / AR-252 / PF-008 → ST-5 (codeops/features/jsvision-ui/plans/editor-family/
 * 07-testing-strategy.md; 03-01-buffer-core.md §eol.ts). The pure realization of the per-buffer
 * EOL policy the Editor composes in Phase 4: `detectEol` (first break wins — the TV
 * `detectLineEndingType` decode, `teditor2.cpp:66-80` region; break-less ⇒ 'lf' per AR-252),
 * `convertNewEdit` (only NEW edits — typed/pasted — normalize to the buffer's ending), and the
 * verbatim store (loaded text keeps mixed EOLs byte-identical, PF-008). Expectations derive from
 * RD-08 + the recorded decodes, never the implementation.
 *
 * Trace: RD-08 03-01 · AR-252 / PF-008 · ST-5.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { GapBuffer, detectEol, eolOf, convertNewEdit } from '../src/editor/buffer/index.js';

// ST-5 / AR-252 — detection: the FIRST line break decides; break-less defaults to 'lf'.
test('ST-5: detectEol — first break wins; none ⇒ lf', () => {
  expect(detectEol('a\r\nb')).toBe('crlf');
  expect(detectEol('a\nb')).toBe('lf');
  expect(detectEol('a\rb')).toBe('cr');
  expect(detectEol('a\nb\r\nc')).toBe('lf'); // the first break (\n) wins over the later \r\n
  expect(detectEol('plain')).toBe('lf'); // break-less ⇒ 'lf'
});

test('ST-5: eolOf maps each kind to its byte sequence', () => {
  expect(eolOf('lf')).toBe('\n');
  expect(eolOf('crlf')).toBe('\r\n');
  expect(eolOf('cr')).toBe('\r');
});

// ST-5 / AC-15 — new edits convert: a typed Enter and a pasted chunk normalize to the buffer kind.
test('ST-5: convertNewEdit normalizes every break run in new-edit text', () => {
  expect(convertNewEdit('\n', 'crlf')).toBe('\r\n'); // typed Enter in a crlf buffer
  expect(convertNewEdit('x\ny', 'crlf')).toBe('x\r\ny'); // pasted LF chunk
  expect(convertNewEdit('x\r\ny\rz\n', 'lf')).toBe('x\ny\nz\n'); // mixed input flattens to lf
  expect(convertNewEdit('no breaks', 'crlf')).toBe('no breaks');
});

// ST-5 / PF-008 — loaded content is stored VERBATIM: mixed EOLs round-trip byte-identical.
test('ST-5: mixed-EOL text stores verbatim and round-trips byte-identical', () => {
  const mixed = 'a\nb\r\nc\rd';
  const g = new GapBuffer(mixed);
  expect(g.text()).toBe(mixed);
  expect(g.slice(0, g.length)).toBe(mixed);
});
