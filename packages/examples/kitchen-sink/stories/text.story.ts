/**
 * Story: `Text` (RD-06) — `TStaticText`, greedy word-wrap + hard-break.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

const PARAGRAPH =
  'This is a TStaticText paragraph. It wraps greedily to the field width and hard-breaks ' +
  'over-long words, exactly like Turbo Vision. Widen or narrow the field and it re-flows across ' +
  'lines with no manual layout.';

export const textStory: Story = {
  id: 'controls/text',
  category: 'Controls',
  title: 'Text',
  rd: 'RD-06',
  blurb: 'TStaticText: greedy word-wrap + hard-break, left-aligned.',
  build(ctx: StoryContext) {
    const fieldWidth = Math.min(48, Math.max(20, ctx.width - 2));
    const g = new Group();
    g.add(at(new Text(`Field width: ${fieldWidth} cells —`), 1, 0, 40, 1));
    g.add(at(new Text(PARAGRAPH), 1, 2, fieldWidth, 6));
    g.add(at(new Text('Static (not focusable). Center / right alignment is deferred (DEF-18).'), 1, 9, 62, 1));
    return g;
  },
};
