/**
 * Implementation test — `Text.severity` internals: the full role-mapping table (including the unset
 * case) and a reactive `() => string` content combined with a severity.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { resolveCapabilities, defaultTheme } from '@jsvision/core';
import { createRenderRoot } from '../src/view/index.js';
import { signal } from '../src/reactive/index.js';
import { Text } from '../src/controls/index.js';
import type { TextSeverity } from '../src/controls/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

function firstCellFg(text: Text): string | undefined {
  const rr = createRenderRoot({ width: 10, height: 1 }, { caps });
  rr.mount(text);
  return rr.buffer().get(0, 0)?.fg;
}

test('impl: the severity→role fg mapping covers unset, error, and warning', () => {
  const cases: [TextSeverity | undefined, string][] = [
    [undefined, defaultTheme.staticText.fg],
    ['error', defaultTheme.dangerText.fg],
    ['warning', defaultTheme.warningText.fg],
  ];
  for (const [severity, expectedFg] of cases) {
    const text = severity === undefined ? new Text('x') : new Text('x', { severity });
    expect(firstCellFg(text), `severity=${String(severity)} → fg`).toBe(expectedFg);
  }
});

test('impl: a reactive content getter repaints and keeps its severity colour', () => {
  const content = signal('a');
  const text = new Text(() => content(), { severity: 'error' });
  const rr = createRenderRoot({ width: 10, height: 1 }, { caps });
  rr.mount(text);

  let cell = rr.buffer().get(0, 0);
  expect(cell?.char, 'initial glyph').toBe('a');
  expect(cell?.fg, 'initial fg = dangerText').toBe(defaultTheme.dangerText.fg);

  content.set('b');
  rr.flush();
  cell = rr.buffer().get(0, 0);
  expect(cell?.char, 'repainted glyph').toBe('b');
  expect(cell?.fg, 'fg stays dangerText after repaint').toBe(defaultTheme.dangerText.fg);
});
