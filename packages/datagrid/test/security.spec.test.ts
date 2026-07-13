/**
 * Specification test (immutable oracle) — `@jsvision/datagrid` ships no dynamic-code-execution sink:
 * the package source contains no `eval(`, `new Function(`, or dynamic `require(` call. There is no
 * user-supplied-code path in the grid, so a static source scan is a sufficient guarantee.
 */
import { test, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Group, Input, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import { column } from '../src/column.js';
import { fromRows } from '../src/data-source.js';
import type { OnCommit } from '../src/commit.js';
import { EditableDataGrid } from '../src/grid.js';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function key(k: string) {
  return { type: 'key' as const, key: k, ctrl: false, alt: false, shift: false };
}

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

// No dynamic-code-execution sink anywhere in the package source.
test('should contain no eval / new Function / dynamic require in package source', () => {
  const forbidden = [/\beval\s*\(/, /\bnew\s+Function\s*\(/, /\brequire\s*\(/];
  const files = tsFiles(srcDir);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const re of forbidden) {
      expect(re.test(text), `${file} must not match ${re}`).toBe(false);
    }
  }
});

const W = 16;
const H = 5;

interface Person {
  id: number;
  name: string;
}

// ST-11 — a control-byte value committed through the editor is stored raw in memory but never reaches
// the frame as a raw ESC/BEL (it passes the engine's sanitize boundary), and the ONLY record mutation
// is through the onCommit/set path (a spy confirms no out-of-band persistence).
test('should sanitize a control-byte edit at the frame and mutate only via onCommit', async () => {
  const rows = signal<Person[]>([{ id: 1, name: 'Ada' }]);
  const spy = vi.fn<OnCommit<Person>>(() => true);
  const columns = [
    column<Person, string>({
      id: 'name',
      title: 'Name',
      value: (r) => r.name,
      parse: (t) => t,
      set: (r, v) => {
        r.name = v;
      },
      width: 10,
    }),
  ];
  const grid = new EditableDataGrid<Person>({
    columns,
    source: fromRows(rows, { rowKey: (r) => r.id }),
    onCommit: spy,
  });
  grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
  const root = new Group();
  root.add(grid);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid.rows);

  loop.dispatch(key('f2'));
  const editor = loop.getFocused();
  if (editor instanceof Input) editor.getValueSignal().set('\x1b[31mX\x07'); // an ESC/BEL-laden value
  loop.dispatch(key('enter'));
  await tick();
  loop.renderRoot.flush();

  // The commit seam is the only mutation path (no direct write behind the model's back).
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][0]).toMatchObject({ rowKey: 1, columnId: 'name', value: '\x1b[31mX\x07' });
  expect(rows()[0].name).toBe('\x1b[31mX\x07'); // stored raw in memory (the model is untouched by rendering)

  // …but nothing reaches the terminal unsanitized: no buffer cell holds a raw ESC/BEL glyph, and BEL —
  // which is never legitimately emitted — is absent from the serialized frame.
  const buf = loop.renderRoot.buffer();
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ch = buf.get(x, y)?.char ?? '';
      expect(ch).not.toBe('\x1b');
      expect(ch).not.toBe('\x07');
    }
  }
  expect(loop.renderRoot.serialize()).not.toContain('\x07');
});
