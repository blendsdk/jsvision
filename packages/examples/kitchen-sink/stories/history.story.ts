/**
 * Story: `History` (RD-14) — the Turbo Vision `THistory` `▐↓▌` button linked to an `Input`, dropping
 * that field's past values (a bounded MRU list) into the shared anchored popup. Pre-seeded so the
 * dropdown has content on first open; the live value echoes below.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Input, Label, Text, History, historyAdd, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

/** A private history id for this story's field (distinct from any app id). */
const PATH_HISTORY_ID = 4200;

export const historyStory: Story = {
  id: 'dropdown/history',
  category: 'Dropdowns',
  title: 'History',
  rd: 'RD-14',
  blurb: 'THistory: a ▐↓▌ button dropping an Input’s past values (MRU) into an anchored popup.',
  build(ctx: StoryContext) {
    const value = signal('~/projects/tui');
    const input = new Input({ value });
    // Seed some prior values so the first drop shows a list (dedup keeps re-builds idempotent).
    for (const past of ['/usr/local/bin', '/etc/hosts', '~/projects/tui', '/var/log/system.log']) {
      historyAdd(PATH_HISTORY_ID, past);
    }
    const history = new History({ link: input, historyId: PATH_HISTORY_ID });
    const width = Math.max(40, ctx.width - 2);

    const g = new Group();
    g.add(at(new Label('~P~ath', input), 1, 0, 6, 1));
    g.add(at(input, 8, 0, 24, 1));
    g.add(at(history, 32, 0, 3, 1)); // the 3-cell ▐↓▌ button, adjacent to the field
    g.add(at(new Text(() => `value = "${value()}"`), 1, 2, width, 1));
    g.add(at(new Text('Click ▐↓▌, or press ↓ / Alt+↓ in the field, to drop the history list.'), 1, 4, width, 1));
    g.add(at(new Text('Pick a row (Enter / click) to fill the field. Esc or click-away cancels.'), 1, 5, width, 1));
    g.add(at(new Text('Oldest entry is at the top; the current field value is recorded on open.'), 1, 6, width, 1));
    return g;
  },
};
