/**
 * Story: `Tree` (RD-15) — an expandable virtual-scroll outline (TV `TOutlineViewer`).
 *
 * A file-tree forest with faithful `│├└─`+`+`/`─` graphics and two-tone collapsed text. `↑↓`/paging
 * move focus, `←`/`→` collapse-or-parent / expand-or-child, `+`/`-`/`*` expand/collapse/expand-subtree,
 * and a graph-zone click toggles while a text click selects. A live echo shows the focused row index
 * and the last selected node's name.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Tree, Text, signal } from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** Terse `TreeNode<string>` builder (a leaf is `children: []`). */
function n(name: string, children: TreeNode<string>[] = []): TreeNode<string> {
  return { value: name, children };
}

/** A small source-tree forest with mixed depth + last/non-last siblings. */
const render = n('render', [n('buffer.ts'), n('serialize.ts'), n('glyphs.ts')]);
const input = n('input', [n('decoder.ts'), n('keymap.ts')]);
const engine = n('engine', [render, input]);
const src = n('src', [n('index.ts'), engine, n('version.ts')]);
const docs = n('docs', [n('getting-started.md'), n('architecture.md')]);
const FOREST: TreeNode<string>[] = [src, docs, n('README.md'), n('package.json')];

export const treeStory: Story = {
  id: 'containers/tree',
  category: 'Containers',
  title: 'Tree',
  rd: 'RD-15',
  blurb: 'TOutlineViewer: ↑↓ move · →/← expand/collapse · +/-/* · graph-click toggles, text-click selects.',
  build(ctx: StoryContext) {
    const roots = signal<TreeNode<string>[]>([...FOREST]);
    const focused = signal(0);
    const selected = signal(-1);
    const selectedName = signal('(none)');
    const tree = new Tree<string>({
      roots,
      getText: (name) => name,
      focused,
      selected,
      command: 'open',
      onSelect: (_index, node) => selectedName.set(node.value),
    });
    // Open the top of the tree so the outline graphics are visible on first paint.
    tree.expand(src);
    tree.expand(engine);

    const g = new Group();
    const treeW = Math.max(24, Math.floor((ctx.width - 4) / 2));
    const treeH = Math.max(8, ctx.height - 4);
    g.add(at(tree, 1, 1, treeW, treeH));

    const echoX = treeW + 3;
    const echoW = Math.max(10, ctx.width - echoX - 1);
    g.add(at(new Text(() => `focused row: #${focused()}`), echoX, 1, echoW, 1));
    g.add(at(new Text(() => `selected: ${selectedName()}`), echoX, 3, echoW, 1));
    g.add(at(new Text('→ expand · ← collapse'), echoX, 5, echoW, 1));
    g.add(at(new Text('+ / - / *  ·  click to toggle/select'), echoX, 6, echoW, 1));
    return g;
  },
};
