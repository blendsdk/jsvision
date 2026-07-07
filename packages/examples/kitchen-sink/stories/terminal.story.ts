/**
 * Story: `Terminal` (RD-08) — the `TTerminal` streaming log sink with a tiny demo capacity so the
 * whole-line ring eviction is visible live; a `~L~og` button appends, the wheel scrolls back.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Button, Terminal, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const terminalStory: Story = {
  id: 'editor/terminal',
  category: 'Editor',
  title: 'Terminal',
  rd: 'RD-08',
  blurb: 'A 32000-unit ring log sink (tiny demo cap: watch old lines evict whole) — wheel scrolls back.',
  build(ctx: StoryContext) {
    const w = Math.max(30, ctx.width - 2);
    const termH = Math.max(4, ctx.height - 6);
    const count = signal(0);
    const g = new Group();

    const term = new Terminal({ capacity: 400 }); // tiny so eviction shows quickly
    for (let i = 0; i < 6; i++) term.writeLine(`boot message ${i} — the ring keeps whole lines`);
    g.add(at(new Text('Terminal (0x1E yellow-on-blue · whole-line eviction at 400 units):'), 1, 0, w, 1));
    g.add(at(term, 1, 1, w, termH));
    g.add(
      at(
        new Button('~L~og a line', {
          onClick: () => {
            count.set(count() + 1);
            term.writeLine(`log entry #${count()} at a tiny capacity — oldest lines evict whole`);
          },
        }),
        1,
        2 + termH,
        16,
        2,
      ),
    );
    g.add(
      at(
        new Text(() => `lines written: ${count()} · wheel = scroll-back, next write snaps down`),
        19,
        3 + termH,
        Math.max(10, w - 19),
        1,
      ),
    );
    return g;
  },
};
