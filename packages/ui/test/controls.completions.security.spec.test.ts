/**
 * Specification tests (immutable oracles) — RD-07 essential-control-completions security (ST-16).
 *
 * Source: jsvision-ui RD-07 AC-15 → ST-16 (essential-control-completions/07-testing-strategy.md).
 * Untrusted input is bounded + filtered + sanitized at every RD-07 entry point: pasted text is
 * `maxLength`/validator-filtered and drawn through `sanitize` (no raw control bytes reach the buffer);
 * `setClipboard` output is base64 (a hostile clipboard string can't inject escape sequences); and the
 * `picture` machine bounds its recursion/iteration/indexing so no hostile mask or input can hang or
 * overflow. Expectations derive from the security ACs, never the implementation.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, setClipboard } from '@jsvision/core';
import { View, Group, createEventLoop, signal, Input, picture, filter } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', osc: { clipboard52: true } },
}).profile;

class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}
function mountInput(opts: ConstructorParameters<typeof Input>[0], w = 20) {
  const input = new Input(opts);
  const stub = new FocusStub();
  const root = new Group();
  root.setLayout({ direction: 'col' });
  input.setLayout({ size: { kind: 'fixed', cells: 1 } });
  stub.setLayout({ size: { kind: 'fixed', cells: 1 } });
  root.add(input);
  root.add(stub);
  const loop = createEventLoop({ width: w, height: 3 }, { caps });
  loop.mount(root);
  loop.focusView(input);
  return { loop, input };
}
function paste(loop: ReturnType<typeof createEventLoop>, text: string): void {
  loop.dispatch({ type: 'paste', text, truncated: false });
}

// ST-16 / AC-15 — a paste is bounded by maxLength (no unbounded growth).
test('ST-16: pasted text is capped at maxLength', () => {
  const value = signal('');
  const { loop } = mountInput({ value, maxLength: 5 });
  paste(loop, '0123456789abcdef'); // far longer than the cap
  expect(value().length).toBeLessThanOrEqual(5);
  expect(value()).toBe('01234');
});

// ST-16 / AC-15 — a paste is validator-filtered code point by code point (invalid ones dropped).
test('ST-16: pasted text is validator-filtered (invalid code points dropped)', () => {
  const value = signal('');
  const { loop } = mountInput({ value, validator: filter('0-9') });
  paste(loop, 'a1b2c3');
  expect(value()).toBe('123');
});

// ST-16 / AC-15 — control bytes in a paste never reach the drawn buffer (sanitize on draw).
test('ST-16: control bytes in a paste are sanitized out of the drawn buffer', () => {
  const value = signal('');
  const { loop } = mountInput({ value }, 20);
  paste(loop, 'a\x1b[31mb\x07c'); // an injection attempt via a pasted SGR + BEL
  const buf = loop.renderRoot.buffer();
  for (let x = 0; x < 20; x++) {
    const ch = buf.get(x, 0)?.char ?? ' ';
    expect(ch.codePointAt(0) ?? 32, `cell ${x}`).toBeGreaterThanOrEqual(32); // no raw C0 control byte drawn
  }
});

// ST-16 / AC-15 — setClipboard output base64-encodes the text: a hostile string cannot inject a raw
// escape sequence into the terminal stream (the payload between the introducer and BEL is pure base64).
test('ST-16: setClipboard output is base64 (no raw escape injection)', () => {
  const seq = setClipboard('hi\x1b]0;pwned\x07there', caps); // a title-set injection attempt in the text
  expect(seq.startsWith('\x1b]52;c;')).toBe(true);
  const payload = seq.slice('\x1b]52;c;'.length, -1); // strip the introducer + BEL terminator
  expect(payload).toMatch(/^[A-Za-z0-9+/=]*$/); // pure base64 — no raw bytes from the text
  expect(seq).not.toContain('\x1b]0;'); // the injected title-set never appears raw
});

// ST-16 / AC-15 — a hostile input against an unbounded "*" mask terminates (the step budget bounds it).
test('ST-16: picture bounds a hostile long input against an unbounded mask (no hang)', () => {
  const star = picture('*#');
  expect(() => star.isValidInput('9'.repeat(50_000))).not.toThrow();
  expect(() => star.isValid('9'.repeat(50_000))).not.toThrow();
});

// ST-16 / AC-15 — a mask whose "*N" exceeds MAX_REPEAT is rejected up front (allowlist), never expanded.
test('ST-16: picture rejects a "*N" mask over MAX_REPEAT without expanding it', () => {
  const hostile = picture('*99999#');
  expect(hostile.error).toBeDefined();
  expect(hostile.isValidInput('1')).toBe(false); // allowlist: reject everything on a bad mask
  expect(hostile.isValid('1')).toBe(false);
});
