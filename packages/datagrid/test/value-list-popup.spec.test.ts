/**
 * Specification tests (immutable oracle) — the Excel value-list section (`value-list-popup.ts`): it
 * populates asynchronously from a `distinct()` thunk, offers a checkbox per distinct label with a
 * type-ahead search that narrows the *visible* labels (never the selection), a Select All, and a
 * visible truncation disclosure. Apply emits the checked label set as a `{ kind: 'set' }` selection.
 *
 * The list is mounted bare in a render root; the async population is awaited before asserting. The
 * public search / selection signals are driven directly (a user would type / click checkboxes).
 * Expectations derive from the requirements/spec docs, never the implementation. The `.js` import
 * specifier is required by NodeNext ESM.
 */
import { test, expect, vi } from 'vitest';
import { Group, createRenderRoot, resolveCapabilities } from '@jsvision/ui';
import type { DistinctResult } from '../src/filter.js';
import { ValueList } from '../src/value-list-popup.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Flush pending microtasks (the async `distinct()` population resolves on one). */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Mount a bare `ValueList` and return it plus a frame reader. */
function build(opts: {
  distinct: () => Promise<DistinctResult>;
  current?: ReadonlySet<string>;
  onApply?: (selected: ReadonlySet<string>) => void;
}) {
  const W = 24;
  const H = 12;
  const list = new ValueList({
    distinct: opts.distinct,
    current: opts.current,
    onApply: opts.onApply ?? (() => undefined),
  });
  list.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(list);
  const render = createRenderRoot({ width: W, height: H }, { caps });
  render.mount(root);
  render.flush();
  const frame = (): string => {
    render.flush();
    const buf = render.buffer();
    let s = '';
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) s += buf.get(x, y)?.char ?? ' ';
      s += '\n';
    }
    return s;
  };
  return { list, render, frame };
}

test('ST-23: checking a subset emits a {set} selection; Select All restores every label', async () => {
  const onApply = vi.fn<(selected: ReadonlySet<string>) => void>();
  const { list } = build({ distinct: () => Promise.resolve({ values: ['A', 'B', 'C'] }), onApply });
  await tick();
  expect(list.visibleLabels()).toEqual(['A', 'B', 'C']);

  list.toggle('C'); // leave only A, B checked (all-checked by default)
  expect(list.checkedLabels()).toEqual(new Set(['A', 'B']));
  list.apply();
  expect(onApply).toHaveBeenCalledWith(new Set(['A', 'B']));

  list.selectAll();
  expect(list.checkedLabels()).toEqual(new Set(['A', 'B', 'C'])); // Select All restores all
});

test('ST-24: the list is populated from source.distinct when the source provides it', async () => {
  const distinct = vi.fn<() => Promise<DistinctResult>>(() => Promise.resolve({ values: ['X', 'Y'] }));
  const { list } = build({ distinct });
  await tick();
  expect(distinct).toHaveBeenCalled();
  expect(list.visibleLabels()).toEqual(['X', 'Y']); // from the delegated distinct, not a client compute
});

test('ST-25: a truncated distinct result shows a visible disclosure (never silent)', async () => {
  const { list, frame } = build({ distinct: () => Promise.resolve({ values: ['A'], truncated: true }) });
  await tick();
  expect(list.truncated()).toBe(true);
  expect(frame()).toMatch(/truncat/i); // the disclosure is rendered, not silent
});

test('ST-26: the search narrows the visible labels case-insensitively; the selection is unchanged', async () => {
  const { list } = build({ distinct: () => Promise.resolve({ values: ['Ada', 'Bo', 'Cara'] }) });
  await tick();
  expect(list.checkedLabels()).toEqual(new Set(['Ada', 'Bo', 'Cara'])); // all checked by default

  list.search.set('a');
  expect(list.visibleLabels()).toEqual(['Ada', 'Cara']); // 'Bo' has no 'a'
  expect(list.checkedLabels()).toEqual(new Set(['Ada', 'Bo', 'Cara'])); // search never changes the selection
});
