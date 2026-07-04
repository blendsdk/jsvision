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
import { reactiveStory } from './reactive.story.js';
import { layoutStory } from './layout.story.js';
import { viewStory } from './view.story.js';
import { eventsStory } from './events.story.js';
import { shellStory } from './shell.story.js';
import { textStory } from './text.story.js';
import { labelStory } from './label.story.js';
import { buttonStory } from './button.story.js';
import { inputStory } from './input.story.js';
import { checkGroupStory } from './checkgroup.story.js';
import { radioGroupStory } from './radiogroup.story.js';
import { multiCheckGroupStory } from './multicheckgroup.story.js';
import { scrollBarStory } from './scrollbar.story.js';
import { scrollerStory } from './scroller.story.js';
import { listViewStory } from './listview.story.js';
import { treeStory } from './tree.story.js';
import { dialogStory } from './dialog.story.js';
import { historyStory } from './history.story.js';
import { comboBoxStory } from './combobox.story.js';
import { dataGridStory } from './data-grid.story.js';
import { tabsStory } from './tabs.story.js';
import { progressBarStory } from './progress-bar.story.js';
import { spinnerStory } from './spinner.story.js';
import { calendarStory } from './calendar.story.js';
import { datePickerStory } from './date-picker.story.js';
import { colorSwatchStory } from './color-swatch.story.js';
import { colorPickerStory } from './color-picker.story.js';

/**
 * Every registered story, in navigator order (Foundations RD-01…05, Controls RD-06, Containers
 * RD-11, Dropdowns RD-14, Feedback RD-18).
 */
export const STORIES: readonly Story[] = [
  reactiveStory,
  layoutStory,
  viewStory,
  eventsStory,
  shellStory,
  textStory,
  labelStory,
  buttonStory,
  inputStory,
  checkGroupStory,
  radioGroupStory,
  multiCheckGroupStory,
  scrollBarStory,
  scrollerStory,
  listViewStory,
  treeStory,
  dataGridStory,
  tabsStory,
  dialogStory,
  historyStory,
  comboBoxStory,
  progressBarStory,
  spinnerStory,
  calendarStory,
  datePickerStory,
  colorSwatchStory,
  colorPickerStory,
];
