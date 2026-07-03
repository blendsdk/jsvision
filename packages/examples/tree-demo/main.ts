/**
 * Tree/outline walkthrough (RD-15) — a narrated, headless console demo of `@jsvision/ui`'s `Tree`
 * (TV `TOutlineViewer`): a file-tree forest expanded, navigated, collapsed, and selected, all driven
 * by synthetic `dispatch()` (no TTY), printing a composed ASCII frame after each step. The faithful
 * `│├└─`+`+`/`─` tree-line graphics and two-tone collapsed text render exactly as on a real terminal.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:tree
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, Tree, createEventLoop, signal } from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false };
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** Terse `TreeNode<string>` builder (a leaf is `children: []`). */
function n(name: string, children: TreeNode<string>[] = []): TreeNode<string> {
  return { value: name, children };
}

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Walk the file-tree forest: expand → navigate → collapse → select. */
function main(): void {
  const render = n('render', [n('buffer.ts'), n('serialize.ts')]);
  const input = n('input', [n('decoder.ts')]);
  const engine = n('engine', [render, input]);
  const src = n('src', [n('index.ts'), engine, n('version.ts')]);
  const docs = n('docs', [n('guide.md')]);
  const roots = signal<TreeNode<string>[]>([src, docs, n('README.md')]);

  const focused = signal(0);
  const selected = signal(-1);
  let selectedName = '(none)';
  const tree = new Tree<string>({
    roots,
    getText: (name) => name,
    focused,
    selected,
    command: 'open',
    onSelect: (_i, node) => (selectedName = node.value),
  });
  tree.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 28, height: 10 } };

  const root = new Group();
  root.add(tree);
  const loop = createEventLoop({ width: 28, height: 10 }, { caps });
  loop.mount(root);
  loop.focusView(tree.rows);
  const frame = (title: string): void => printFrame(title, loop.renderRoot.buffer().rows());

  // Step 1 — the collapsed forest: each parent shows the `+` marker.
  frame('Frame 1 — collapsed forest (src +, docs +, README.md)');

  // Step 2 — → expands the focused root `src`, revealing its children.
  loop.dispatch(key('right'));
  frame('Frame 2 — → expands src (index.ts, engine +, version.ts)');

  // Step 3 — ↓↓ moves focus to `engine`, then → expands it.
  loop.dispatch(key('down'));
  loop.dispatch(key('down'));
  loop.dispatch(key('right'));
  frame('Frame 3 — ↓↓ to engine, → expands it (render +, input +)');
  console.log(`  focused row: #${focused()}`);

  // Step 4 — ← collapses the focused `engine` subtree again.
  loop.dispatch(key('left'));
  frame('Frame 4 — ← collapses engine');

  // Step 5 — ↓ to `version.ts`, Enter selects it (emits `open`).
  loop.dispatch(key('down'));
  loop.dispatch(key('enter'));
  frame('Frame 5 — ↓ to version.ts, Enter selects it');
  console.log(`  selected: #${selected()} = ${selectedName}`);

  console.log('\nDone — a Tree expanded (→/+), navigated (↑↓), collapsed (←/-), and selected (Enter).');
}

main();
