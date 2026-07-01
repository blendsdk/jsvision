/**
 * The kitchen-sink **story registry** — the aggregated list the shell + smoke test read.
 *
 * Explicit aggregation (no import-side-effects): adding a component to the showcase = write its
 * `*.story.ts` and add it to this array. Keep entries grouped by category and ordered as they should
 * appear in the navigator.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Story } from '../story.js';
import { textStory } from './text.story.js';
import { labelStory } from './label.story.js';
import { buttonStory } from './button.story.js';
import { inputStory } from './input.story.js';
import { checkGroupStory } from './checkgroup.story.js';
import { radioGroupStory } from './radiogroup.story.js';

/** Every registered story, in navigator order. */
export const STORIES: readonly Story[] = [
  textStory,
  labelStory,
  buttonStory,
  inputStory,
  checkGroupStory,
  radioGroupStory,
];
