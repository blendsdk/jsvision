/**
 * Specification tests (immutable oracle) — RD-14 dropdown packaging + security (ST-34, ST-35).
 *
 * Source: jsvision-ui/RD-14 AC-12/AC-14 → ST-34/ST-35 (input-dropdowns/07-testing-strategy.md).
 *   • ST-34 (packaging): the `dropdown/` subsystem lives under `src/` with explicit named re-exports
 *     from `src/index.ts` (imported here BY NAME from `@jsvision/ui`, the published surface); the
 *     package declares zero native runtime deps; every source file is ≤ 500 lines.
 *   • ST-35 (security): history/item text is sanitized to screen (a raw escape never reaches the
 *     buffer), the MRU store is bounded + bounds-checked, and picked field text is clamped to the
 *     `Input`'s `maxLength`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveCapabilities } from '@jsvision/core';
import type { MouseEvent as CoreMouseEvent } from '@jsvision/core';
import {
  History,
  ComboBox,
  historyAdd,
  historyStr,
  historyCount,
  historyEntries,
  clearHistory,
  HISTORY_MAX_ENTRIES,
  createRenderRoot,
  createEventLoop,
  Group,
  Input,
  signal,
} from '@jsvision/ui';
import type { PopupHost } from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));
const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ── ST-34 (packaging) ────────────────────────────────────────────────────────────────────────────

test('ST-34: History + ComboBox are exported classes from @jsvision/ui', () => {
  expect(typeof History).toBe('function');
  expect(typeof ComboBox).toBe('function');
});

test('ST-34: the global MRU store functions are exported from @jsvision/ui', () => {
  for (const fn of [historyAdd, historyStr, historyCount, historyEntries, clearHistory]) {
    expect(typeof fn).toBe('function');
  }
  expect(HISTORY_MAX_ENTRIES).toBe(16);
});

test('ST-34: each dropdown source file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'dropdown');
  expect(existsSync(dir)).toBe(true);
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

test('ST-34: @jsvision/ui declares only the workspace @jsvision/core runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});

// ── ST-35 (security) ─────────────────────────────────────────────────────────────────────────────

test('ST-35: a raw escape in a history entry is sanitized before it reaches the screen', () => {
  clearHistory();
  const value = signal('');
  const input = new Input({ value });
  input.setLayout({ position: 'absolute', rect: { x: 0, y: 1, width: 20, height: 1 } });
  const hist = new History({ link: input, historyId: 77 });
  hist.setLayout({ position: 'absolute', rect: { x: 20, y: 1, width: 3, height: 1 } });
  // A malicious past value carrying a raw CSI escape (would move the cursor / recolor if unescaped).
  historyAdd(77, '[31mHACK[0m');

  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 12 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(input);
  root.add(hist);
  root.add(overlay);
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  loop.focusView(input);
  const down: CoreMouseEvent = { type: 'mouse', kind: 'down', button: 0, x: 21, y: 2 };
  loop.dispatch(down); // open the popup over the malicious entry
  loop.renderRoot.flush();

  // No cell in the composed buffer holds a raw ESC (0x1b) — the sanitize boundary stripped it.
  const rows = loop.renderRoot.buffer().rows();
  for (const row of rows) for (const cell of row) expect(cell.char.charCodeAt(0)).not.toBe(0x1b);
});

test('ST-35: the MRU store is bounded to HISTORY_MAX_ENTRIES and reads are bounds-checked', () => {
  clearHistory();
  for (let i = 0; i < HISTORY_MAX_ENTRIES + 10; i += 1) historyAdd(5, `entry-${i}`);
  expect(historyCount(5)).toBe(HISTORY_MAX_ENTRIES); // never grows past the cap
  expect(historyStr(5, -1)).toBeUndefined(); // out-of-range read → undefined, not a throw
  expect(historyStr(5, HISTORY_MAX_ENTRIES)).toBeUndefined();
});

test('ST-35: a picked history value is clamped to the linked field maxLength', () => {
  clearHistory();
  const value = signal('');
  const input = new Input({ value, maxLength: 4 });
  input.setLayout({ position: 'absolute', rect: { x: 0, y: 1, width: 20, height: 1 } });
  const hist = new History({ link: input, historyId: 88 });
  hist.setLayout({ position: 'absolute', rect: { x: 20, y: 1, width: 3, height: 1 } });
  historyAdd(88, 'super-long-value'); // longer than maxLength

  const overlay = new Group();
  overlay.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 12 } });
  overlay.state.visible = false;
  const root = new Group();
  root.add(input);
  root.add(hist);
  root.add(overlay);
  const loop = createEventLoop({ width: 40, height: 12 }, { caps });
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  loop.focusView(input);
  const down: CoreMouseEvent = { type: 'mouse', kind: 'down', button: 0, x: 21, y: 2 };
  loop.dispatch(down); // open (count 1 → focus index 0)
  loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift: false }); // pick

  expect(value()).toBe('supe'); // clamped to maxLength 4 (TV strnzcpy(link->data, rslt, maxLen+1))
});

// A guard the packaging spec can't reach: the render-root default encoder is used above, so the
// sanitize assertion exercises the real @jsvision/core injection boundary (not a stub).
test('ST-35: sanitized ComboBox item text also reaches the screen escape-free', () => {
  const items = signal([']0;titleok']); // OSC-injection attempt
  const value = signal<string | null>(null);
  const combo = new ComboBox<string>({ items, getText: (s) => s, value });
  const rr = createRenderRoot({ width: 20, height: 1 }, { caps });
  rr.mount(combo);
  const rows = rr.buffer().rows();
  for (const row of rows) for (const cell of row) expect(cell.char.charCodeAt(0)).not.toBe(0x1b);
});
