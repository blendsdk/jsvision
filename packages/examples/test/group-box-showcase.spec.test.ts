/** Immutable kitchen-sink specifications for the GroupBox showcase. */
import { expect, test } from 'vitest';
import { defaultTheme, resolveCapabilities } from '@jsvision/core';
import { Button, Group, GroupBox, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { STORIES } from '../kitchen-sink/stories/index.js';
import { at } from '../kitchen-sink/story.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
const WIDTH = 54;
const HEIGHT = 17;

/** Return the single registered GroupBox story, failing clearly when registry wiring is absent. */
function groupBoxStory() {
  const story = STORIES.find((candidate) => candidate.id === 'containers/group-box');
  if (story === undefined) throw new Error('the containers/group-box story is not registered');
  return story;
}

/** Return a depth-first list that includes the root and every descendant view. */
function descendants(view: View): View[] {
  if (!(view instanceof Group)) return [view];
  return [view, ...view.children.flatMap(descendants)];
}

/** Flatten the current terminal buffer into newline-separated display text. */
function frameText(loop: ReturnType<typeof createEventLoop>): string {
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

test('registers one bounded Containers story with complete metadata and visible output', () => {
  const matches = STORIES.filter((story) => story.id === 'containers/group-box');
  expect(matches).toHaveLength(1);
  expect(matches[0]).toMatchObject({ category: 'Containers', title: 'GroupBox' });
  expect(matches[0]?.blurb).toMatch(/caption|group/i);
  expect(matches[0]?.rd).toBeUndefined();

  const canvas = at(matches[0]!.build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
  const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
  loop.mount(canvas);
  const text = frameText(loop);

  expect(text).toContain('Application');
  expect(text).toContain('Modules');
  expect(text).toContain('界');
  expect(text).toMatch(/[┌┐└┘─│]/);
  loop.dispose();
});

test('shows all alignments, nesting, role variation, and shadowed and plain boxes together', () => {
  const canvas = groupBoxStory().build({ caps, width: WIDTH, height: HEIGHT });
  const boxes = descendants(canvas).filter((view): view is GroupBox => view instanceof GroupBox);
  const buttons = descendants(canvas).filter((view): view is Button => view instanceof Button);

  expect(boxes.length).toBeGreaterThanOrEqual(4);
  expect(boxes.some((box) => box.castsShadow)).toBe(true);
  expect(boxes.some((box) => !box.castsShadow)).toBe(true);
  expect(boxes.some((box) => boxes.some((candidate) => candidate.parent === box))).toBe(true);
  expect(buttons.length).toBeGreaterThanOrEqual(1);

  const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
  loop.mount(at(canvas, 0, 0, WIDTH, HEIGHT));
  const rows = frameText(loop).split('\n');

  expect(rows.some((row) => row.indexOf('Application') >= 0 && row.indexOf('Application') <= 5)).toBe(true);
  expect(rows.some((row) => row.indexOf('Modules') > 5 && row.indexOf('Modules') < 25)).toBe(true);
  expect(rows.some((row) => row.lastIndexOf('End') > 40)).toBe(true);

  const buffer = loop.renderRoot.buffer();
  expect(buffer.get(27, 0)?.char).toBe('┌');
  expect(buffer.get(51, 0)?.char).toBe('┐');
  expect(buffer.get(27, 12)?.char).toBe('└');
  expect(buffer.get(51, 12)?.char).toBe('┘');
  expect(buffer.get(52, 8)?.bg).toBe(defaultTheme.shadow.bg);
  expect(buffer.get(29, 13)?.bg).toBe(defaultTheme.shadow.bg);
  expect(rows[15]).toContain('Tab focuses the button');
  expect(buffer.get(2, 4)?.char).toBe('└');
  expect(buffer.get(23, 4)?.char).toBe('┘');
  loop.dispose();
});

test('keeps focus on descendants while a reachable action updates the reactive caption and status', () => {
  const canvas = at(groupBoxStory().build({ caps, width: WIDTH, height: HEIGHT }), 0, 0, WIDTH, HEIGHT);
  const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
  loop.mount(canvas);
  loop.focusNext();

  const focused = loop.getFocused();
  expect(focused).toBeInstanceOf(Button);
  expect(focused).not.toBeInstanceOf(GroupBox);
  const before = frameText(loop);

  loop.dispatch({ type: 'key', key: 'space', ctrl: false, alt: false, shift: false });
  loop.renderRoot.flush();
  const after = frameText(loop);

  expect(after).not.toBe(before);
  expect(after).toContain('Modules: 3');
  expect(after).toContain('Added module 3');
  expect(loop.getFocused()).toBe(focused);

  expect(() => loop.dispose()).not.toThrow();
  expect(canvas.mounted).toBe(false);
});
