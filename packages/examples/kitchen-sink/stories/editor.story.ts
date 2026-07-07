/**
 * Story: `Editor` (RD-08) — the faithful `TEditor` port: gap buffer, WordStar keymap, selection,
 * scrolling, and the live `line:col` indicator.
 *
 * A pre-loaded editor inside a mini EditWindow-style frame with an `Indicator` strip below it and
 * a bound `line:col · modified` echo. WordStar chords work live (Ctrl-Q F would open find when a
 * dialog seam is wired; motions/selection/delete/undo run here): arrows move, Shift+arrows select,
 * double-click selects a word, triple-click a line, Ctrl-Y deletes a line, Ctrl-U undoes.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, Text, Editor, Indicator } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

const SAMPLE = [
  'The quick brown fox jumps over the lazy dog.',
  '',
  '\tTabs expand to 8-column stops (TV formatLine).',
  'Select with Shift+arrows — the 0x71 reverse band.',
  'Double-click a word, triple-click a line.',
  'Ctrl-Y deletes a line; Ctrl-U undoes; Ins toggles overwrite.',
].join('\n');

export const editorStory: Story = {
  id: 'editor/editor',
  category: 'Editor',
  title: 'Editor',
  rd: 'RD-08',
  blurb: 'The TEditor port — WordStar keys, selection, undo, indicator sync. Click in, then type.',
  build(ctx: StoryContext) {
    const w = Math.max(30, ctx.width - 2);
    const edH = Math.max(4, ctx.height - 5);
    const g = new Group();

    const ed = new Editor();
    ed.setText(SAMPLE);
    const ind = new Indicator();
    ed.attachGadgets(undefined, undefined, ind);

    g.add(at(ed, 1, 1, w, edH));
    g.add(at(ind, 1, 1 + edH, 14, 1));
    g.add(
      at(
        new Text(
          () => `line:col ${ed.curPos().line}:${ed.curPos().col} · ${ed.modified() ? 'modified *' : 'unmodified'}`,
        ),
        17,
        1 + edH,
        Math.max(10, w - 17),
        1,
      ),
    );
    g.add(at(new Text('Arrows/Home/End move · Shift extends · Ctrl-K B/K block ops · Ctrl-U undo.'), 1, 3 + edH, w, 1));
    return g;
  },
};
