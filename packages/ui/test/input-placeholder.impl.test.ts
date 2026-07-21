/**
 * Implementation test — `Input.placeholder` internals: a reactive `Signal<string>` placeholder
 * repaints an empty field; a focused caret overlays column 1 while the rest of the placeholder shows;
 * the muted bg tracks the field's focus role; and `maxLength`/`validator` are unaffected by a placeholder.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { View, Group, createRenderRoot } from '../src/view/index.js';
import type { DrawContext } from '../src/view/index.js';
import { createEventLoop } from '../src/event/index.js';
import { signal } from '../src/reactive/index.js';
import { Input, filter } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function key(k: string): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false };
}

class FocusStub extends View {
  override focusable = true;
  draw(_ctx: DrawContext): void {}
}

/** Mount one focused Input (width `w`) plus a trailing stub, then focus the Input. */
function mountFocused(opts: ConstructorParameters<typeof Input>[0], w = 10) {
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
  return { loop, input, stub };
}

function rowOf(buf: ReturnType<ReturnType<typeof createRenderRoot>['buffer']>, width: number): string {
  let s = '';
  for (let x = 0; x < width; x++) s += buf.get(x, 0)?.char ?? ' ';
  return s;
}

test('impl: a Signal<string> placeholder repaints an empty field when it changes', () => {
  const ph = signal('one');
  const rr = createRenderRoot({ width: 10, height: 1 }, { caps });
  rr.mount(new Input({ value: signal(''), placeholder: ph }));
  expect(rowOf(rr.buffer(), 10)).toBe(' one      ');
  ph.set('two');
  rr.flush();
  expect(rowOf(rr.buffer(), 10)).toBe(' two      ');
});

test('impl: a focused caret overlays the first placeholder glyph without erasing it', () => {
  const { loop } = mountFocused({ value: signal(''), placeholder: 'Name' }, 10);
  const buf = loop.renderRoot.buffer();
  // The caret reverses col 1 but REUSES the placeholder glyph 'N' rather than blanking it (the caret
  // overlays, it does not erase — regression guard for the "Try" → "ry" bug).
  expect(buf.get(1, 0)?.char, "col 1 is the reversed caret over the 'N', not a blank").toBe('N');
  expect(buf.get(1, 0)?.bg, 'caret bg = the field fg (reversed)').toBe(defaultTheme.inputSelected.fg);
  // The rest of the placeholder still shows, muted, from col 2.
  expect(buf.get(2, 0)?.char, "placeholder 'a' still shows at col 2").toBe('a');
  expect(buf.get(2, 0)?.fg, 'still muted (inputPlaceholder fg)').toBe(defaultTheme.inputPlaceholder.fg);
});

test('impl: the muted placeholder bg tracks the field focus role', () => {
  // Unfocused: the placeholder sits on the inputNormal field bg.
  const buf = createRenderRoot({ width: 10, height: 1 }, { caps });
  buf.mount(new Input({ value: signal(''), placeholder: 'Name' }));
  expect(buf.buffer().get(2, 0)?.bg, 'unfocused placeholder bg = inputNormal').toBe(defaultTheme.inputNormal.bg);
  // Focused: it sits on the inputSelected field bg.
  const { loop } = mountFocused({ value: signal(''), placeholder: 'Name' }, 10);
  expect(loop.renderRoot.buffer().get(2, 0)?.bg, 'focused placeholder bg = inputSelected').toBe(
    defaultTheme.inputSelected.bg,
  );
});

test('impl: a placeholder does not affect maxLength or the validator', () => {
  const value = signal('');
  const { loop } = mountFocused({ value, placeholder: 'digits', maxLength: 3, validator: filter('0-9') }, 10);
  loop.dispatch(key('a')); // not a digit → rejected by the validator; placeholder is irrelevant
  expect(value()).toBe('');
  for (const ch of '1234') loop.dispatch(key(ch)); // maxLength 3 caps the stored value
  expect(value()).toBe('123');
});
