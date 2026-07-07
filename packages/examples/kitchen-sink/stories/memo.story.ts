/**
 * Story: `Memo` (RD-08) — the dialog-embeddable editor bound two-way to a `Signal<string>`, beside
 * an `Input` proving Tab-transparency (the `tmemo.cpp:69-73` kbTab drop; AC-10 made visible).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Label, Input, Memo, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const memoStory: Story = {
  id: 'editor/memo',
  category: 'Editor',
  title: 'Memo',
  rd: 'RD-08',
  blurb: 'A two-way Signal<string> memo in a form — Tab moves focus (never inserts), gray-chain colours.',
  build(ctx: StoryContext) {
    const notes = signal('Multiline notes…\nTab jumps to the Name field.');
    const name = signal('');
    const w = Math.max(30, ctx.width - 2);
    const memoH = Math.max(3, ctx.height - 7);
    const g = new Group();

    const memo = new Memo({ value: notes });
    g.add(at(new Text('~N~otes (Memo — 0x30 black-on-cyan):'), 1, 0, w, 1));
    g.add(at(memo, 1, 1, w, memoH));
    const input = new Input({ value: name });
    g.add(at(new Label('N~a~me', input), 1, 2 + memoH, 8, 1));
    g.add(at(input, 9, 2 + memoH, Math.max(10, w - 9), 1));
    g.add(
      at(new Text(() => `bound signal: ${JSON.stringify(notes()).slice(0, Math.max(10, w - 16))}`), 1, 4 + memoH, w, 1),
    );
    return g;
  },
};
