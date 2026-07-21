/**
 * Implementation tests (edge cases / internals) — RD-14 `History` control.
 *
 * Companion to `history.spec.test.ts`: the open-guard (a disabled link cannot open the popup), an
 * empty store shows an empty popup (never throws), the `Infinity` maxLength clamp is a no-op, and a
 * no-overlay-host open is a safe no-op.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect, beforeEach } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent, MouseEvent as CoreMouseEvent } from '@jsvision/core';
import { Group } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { Input } from '../src/controls/index.js';
import { createEventLoop } from '../src/event/index.js';
import { History, historyAdd, historyStr, clearHistory } from '../src/dropdown/index.js';
import { ListView } from '../src/list/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function mouseDown(x: number, y: number): CoreMouseEvent {
  return { type: 'mouse', kind: 'down', button: 0, x, y };
}
function key(k: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

beforeEach(() => {
  clearHistory();
});

interface App {
  loop: ReturnType<typeof createEventLoop>;
  value: ReturnType<typeof signal<string>>;
  link: Input;
  hist: History;
  overlay: Group;
}

function makeApp(opts: { fieldValue?: string; historyId?: number; maxLength?: number } = {}): App {
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  const value = signal(opts.fieldValue ?? '');
  const link = new Input({ value, maxLength: opts.maxLength });
  link.setLayout({ position: 'absolute', rect: { x: 5, y: 3, width: 10, height: 1 } });
  const hist = new History({ link, historyId: opts.historyId ?? 1 });
  hist.setLayout({ position: 'absolute', rect: { x: 15, y: 3, width: 3, height: 1 } });
  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(link);
  root.add(hist);
  root.add(overlay);
  loop.mount(root);
  loop.popupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  return { loop, value, link, hist, overlay };
}

function popupOpen(overlay: Group): boolean {
  return overlay.state.visible && overlay.children.some((c) => c instanceof Group);
}

test('open-guard: a disabled link does not open the popup (TV !link->focus() guard)', () => {
  const app = makeApp({ historyId: 1 });
  historyAdd(1, 'x');
  app.link.state.disabled = true;

  app.loop.dispatch(mouseDown(16, 4));
  expect(popupOpen(app.overlay)).toBe(false);
});

test('opening with an empty store + empty field shows an empty popup and does not throw', () => {
  const app = makeApp({ fieldValue: '', historyId: 5 });
  expect(historyStr(5, 0)).toBeUndefined();

  expect(() => app.loop.dispatch(mouseDown(16, 4))).not.toThrow();
  expect(popupOpen(app.overlay)).toBe(true);
  const frame = app.overlay.children.find((c): c is Group => c instanceof Group);
  const list = frame?.children.find((c): c is ListView<string> => c instanceof ListView);
  expect(list).toBeDefined(); // an (empty) list is hosted — the popup shows <empty>, not a crash
});

test('Infinity maxLength (unbounded) clamps to a no-op — the full value is written on pick', () => {
  const app = makeApp({ historyId: 1 }); // no maxLength → Infinity
  historyAdd(1, 'a-very-long-history-value');

  app.loop.dispatch(mouseDown(16, 4)); // open → [a-very-long...], count 1, focus 0
  app.loop.dispatch(key('enter'));

  expect(app.value()).toBe('a-very-long-history-value'); // slice(0, Infinity) is a no-op
});

test('opening with no overlay host is a safe no-op (headless / no shell)', () => {
  const app = makeApp({ historyId: 1 });
  historyAdd(1, 'x');
  app.loop.popupHost = undefined; // no host wired

  expect(() => app.loop.dispatch(mouseDown(16, 4))).not.toThrow();
  expect(popupOpen(app.overlay)).toBe(false);
});
