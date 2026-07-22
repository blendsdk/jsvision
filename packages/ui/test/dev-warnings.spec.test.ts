/**
 * Specification tests (immutable oracles) — the developer-warning sink.
 *
 * Derived from the requirement that a framework diagnostic must reach the developer without ever
 * writing to the terminal the renderer owns:
 *
 *  - a warning raised before an app takes the screen goes straight to `console.warn` (the existing
 *    behaviour of the three pre-mount call sites, unchanged);
 *  - a warning raised while a screen session is active is withheld and flushed to stderr only once
 *    the terminal has been restored;
 *  - a repeating condition warns once, never once per frame;
 *  - nothing is emitted at all under `NODE_ENV === 'production'`.
 */
import { test, expect, vi, afterEach } from 'vitest';
import { devWarn, beginScreenSession, endScreenSession, resetDevWarnings } from '../src/shared/warnings.js';

afterEach(() => {
  resetDevWarnings();
  vi.restoreAllMocks();
});

test('a warning raised outside a screen session reaches console.warn, tagged with its scope', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  devWarn('layout', 'Panel never appears');

  expect(warn).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith('[jsvision/ui layout] Panel never appears');
});

test('a repeating condition warns once, not once per occurrence', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  devWarn('layout', 'Panel never appears');
  devWarn('layout', 'Panel never appears');
  devWarn('layout', 'Panel never appears');

  expect(warn).toHaveBeenCalledTimes(1);
});

test('a distinct message still warns — de-duplication is per (scope, message), not global', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  devWarn('layout', 'Panel never appears');
  devWarn('focus', 'Panel never appears');
  devWarn('layout', 'Sidebar never appears');

  expect(warn).toHaveBeenCalledTimes(3);
});

test('a warning raised while the app owns the screen never writes to the console', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beginScreenSession();
  devWarn('layout', 'Panel never appears');

  // Nothing has reached any stream: the alternate screen is live and both would corrupt it.
  expect(warn).not.toHaveBeenCalled();
  expect(stderr).not.toHaveBeenCalled();
});

test('warnings withheld during a screen session are flushed to stderr once the terminal is restored', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  beginScreenSession();
  devWarn('layout', 'Panel never appears');
  devWarn('focus', 'focusView(Group) did nothing');
  endScreenSession();

  expect(warn).not.toHaveBeenCalled();
  const flushed = stderr.mock.calls.map((call) => String(call[0])).join('');
  expect(flushed).toContain('[jsvision/ui layout] Panel never appears');
  expect(flushed).toContain('[jsvision/ui focus] focusView(Group) did nothing');
});

test('after the session ends, warnings go back to console.warn', () => {
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  beginScreenSession();
  endScreenSession();
  devWarn('layout', 'Panel never appears');

  expect(warn).toHaveBeenCalledWith('[jsvision/ui layout] Panel never appears');
});

test('every sink is silent under NODE_ENV=production', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  try {
    devWarn('layout', 'Panel never appears');
    beginScreenSession();
    devWarn('focus', 'focusView(Group) did nothing');
    endScreenSession();
  } finally {
    process.env.NODE_ENV = previous;
  }

  expect(warn).not.toHaveBeenCalled();
  expect(stderr).not.toHaveBeenCalled();
});
