/**
 * Specification test (immutable oracle) — `Input.placeholder` + propagation (ST-U4…U12).
 *
 * `Input` gains a `placeholder?: string | Signal<string>`: a muted hint shown ONLY while the bound
 * value is empty, never part of the value, clipped to the field width, sanitised on the render path,
 * and forwarded to `DatePicker`, `ComboBox` (editable), and `inputBox()`. Real controls over a real
 * `RenderRoot`/app; cells read back pre-serialize. Expectations derive from RD-09, never the impl.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { createRenderRoot } from '../src/view/index.js';
import type { View } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, Text } from '../src/controls/index.js';
import { DatePicker } from '../src/date/index.js';
import type { CalendarDate } from '../src/date/index.js';
import { ComboBox } from '../src/dropdown/index.js';
import { inputBox } from '../src/dialog/index.js';
import { createApplication } from '../src/app/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Mount a view as the render root and return its buffer. */
function mountBuffer(view: View, width: number, height = 1): ReturnType<ReturnType<typeof createRenderRoot>['buffer']> {
  const rr = createRenderRoot({ width, height }, { caps });
  rr.mount(view);
  return rr.buffer();
}

/** Read row `y` of a buffer as a string of `width` cells. */
function rowText(buf: ReturnType<typeof mountBuffer>, y: number, width: number): string {
  let s = '';
  for (let x = 0; x < width; x++) s += buf.get(x, y)?.char ?? ' ';
  return s;
}

/** Whether any row of a buffer contains `substr` (robust to the control's x-offset within a group). */
function bufferHasText(buf: ReturnType<typeof mountBuffer>, width: number, height: number, substr: string): boolean {
  for (let y = 0; y < height; y++) if (rowText(buf, y, width).includes(substr)) return true;
  return false;
}

test('ST-U4: a placeholder over an empty value is painted muted (staticText fg on the field bg)', () => {
  const buf = mountBuffer(new Input({ value: signal(''), placeholder: 'Name' }), 10);
  expect(rowText(buf, 0, 10)).toBe(' Name     '); // starts at col 1, field is unfocused (no caret)
  // Muted style: staticText fg over the (unfocused) inputNormal field bg.
  expect(buf.get(2, 0)?.fg, "placeholder 'a' fg = staticText").toBe(defaultTheme.staticText.fg);
  expect(buf.get(2, 0)?.bg, 'placeholder bg = inputNormal field').toBe(defaultTheme.inputNormal.bg);
});

test('ST-U5: the placeholder disappears the instant the value is non-empty', () => {
  const value = signal('');
  const rr = createRenderRoot({ width: 10, height: 1 }, { caps });
  rr.mount(new Input({ value, placeholder: 'Name' }));
  value.set('A');
  rr.flush();
  const buf = rr.buffer();
  expect(buf.get(1, 0)?.char, 'the value shows').toBe('A');
  expect(buf.get(1, 0)?.fg, 'value fg = inputNormal, not muted').toBe(defaultTheme.inputNormal.fg);
  expect(buf.get(2, 0)?.char, 'no placeholder past the value').toBe(' ');
});

test('ST-U6: the placeholder is never the bound value — an untouched field reads empty', () => {
  const value = signal('');
  mountBuffer(new Input({ value, placeholder: 'Name' }), 10);
  expect(value(), 'reading the untouched field yields empty string').toBe('');
});

test('ST-U7: an empty placeholder paints nothing extra (blank field)', () => {
  const buf = mountBuffer(new Input({ value: signal(''), placeholder: '' }), 10);
  expect(rowText(buf, 0, 10)).toBe('          '); // all blank
});

test('ST-U8: a placeholder wider than the field is clipped to width-1, no wrap or overflow', () => {
  const buf = mountBuffer(new Input({ value: signal(''), placeholder: 'abcdefghijklmnop' }), 10);
  expect(rowText(buf, 0, 10)).toBe(' abcdefghi'); // col 0 blank, cols 1..9 = first 9 chars
});

test('ST-U9: both the placeholder and a severity-Text content are sanitised on the render path', () => {
  const evil = 'a\x00b\x1b[31mc\x9b';
  // Placeholder path.
  const phBuf = mountBuffer(new Input({ value: signal(''), placeholder: evil }), 20);
  // Severity-Text path (its content flows through the same ctx.text → sanitize → buffer path).
  const txtBuf = mountBuffer(new Text(evil, { severity: 'error' }), 20);
  for (const buf of [phBuf, txtBuf]) {
    for (let x = 0; x < 20; x++) {
      const ch = buf.get(x, 0)?.char ?? ' ';
      for (const cp of [...ch].map((c) => c.codePointAt(0) ?? 0x20)) {
        expect(cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f), `no control byte at col ${x}`).toBe(false);
      }
    }
  }
});

test('ST-U10: DatePicker forwards the placeholder to its empty inner field', () => {
  const value = signal<CalendarDate | null>(null);
  const buf = mountBuffer(new DatePicker({ value, placeholder: 'YYYY-MM-DD' }), 24, 1);
  expect(bufferHasText(buf, 24, 1, 'YYYY-MM-DD'.slice(1)), 'the placeholder shows in the field').toBe(true);
});

test('ST-U11: an editable ComboBox forwards the placeholder to its empty inner field', () => {
  const cb = new ComboBox<string>({
    items: signal(['alpha', 'beta']),
    getText: (s) => s,
    value: signal<string | null>(null),
    editable: true,
    placeholder: 'Pick one',
  });
  const buf = mountBuffer(cb, 24, 1);
  expect(bufferHasText(buf, 24, 1, 'Pick one'.slice(1)), 'the placeholder shows in the field').toBe(true);
});

test('ST-U12: inputBox forwards the placeholder to its empty prompt field', async () => {
  const app = createApplication({ caps, viewport: { width: 80, height: 24 } });
  const value = signal('');
  const p = inputBox(app, { title: 'Rename', label: 'Name', value, placeholder: 'new name' });
  app.loop.renderRoot.flush();
  const buf = app.loop.renderRoot.buffer();
  expect(bufferHasText(buf, 80, 24, 'new name'.slice(1)), 'the placeholder shows in the prompt field').toBe(true);
  app.loop.emitCommand('cancel');
  await p;
});
