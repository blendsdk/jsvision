/**
 * A Tree laboratory demonstrating view-owned expansion, directional navigation, bracket markers,
 * and independent focus and activation state.
 */
import { Dialog, Group, Label, Text, Tree, at, signal } from '@jsvision/ui';
import type { TreeNode } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_WIDTH = 48;
const CONTENT_HEIGHT = 12;

/** Create one immutable project node. */
function node(value: string, children: readonly TreeNode<string>[] = []): TreeNode<string> {
  return { value, children: [...children] };
}

export default defineExample({
  title: 'Tree Lab',
  blurb: 'Expand, descend, and activate a project outline while navigation and selection stay independent.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const roots = signal<TreeNode<string>[]>([
      node('src', [node('index.ts'), node('engine', [node('buffer.ts'), node('events.ts')])]),
      node('README.md'),
    ]);
    const selected = signal(-1);
    const opened = signal('none');
    const tree = new Tree<string>({
      roots,
      getText: (value) => value,
      selected,
      markerStyle: 'brackets',
      onSelect: (_index, selectedNode) => opened.set(selectedNode.value),
    });
    const dialog = new Dialog({ title: ' Tree Lab ', width: 52, height: 16 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Tree owns expansion; node data stays plain.'), 0, 0, 48, 1));
    content.add(at(new Label('~P~roject', tree.rows), 0, 2, 10, 1));
    content.add(at(tree, 11, 2, 27, 7));
    content.add(at(new Text(() => `Selected: ${selected()}`), 40, 2, 8, 2));
    content.add(at(new Text(() => `Opened: ${opened()}`), 0, 9, 48, 1));
    content.add(at(new Text('Right expands/descends · Left collapses/returns'), 0, 10, 48, 1));
    content.add(at(new Text('Enter selects · +/−/* branches · Alt+P focus'), 0, 11, 48, 1));

    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(tree.rows);
    return app;
  },
});
