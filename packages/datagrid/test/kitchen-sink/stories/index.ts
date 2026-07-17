/**
 * The datagrid showcase registry — explicit aggregation (the examples idiom). Add one import + one
 * array entry per new story.
 */
import type { Story } from '../story.js';
import { foundationStory } from './foundation.story.js';
import { editingStory } from './editing.story.js';
import { editorsStory } from './editors.story.js';
import { formattingStory } from './formatting.story.js';
import { sortingStory } from './sorting.story.js';
import { filteringStory } from './filtering.story.js';
import { columnsLayoutStory } from './columns-layout.story.js';
import { rowsSelectionStory } from './rows-selection.story.js';
import { footerMasterDetailStory } from './footer-master-detail.story.js';

export const STORIES: readonly Story[] = [
  foundationStory,
  editingStory,
  editorsStory,
  formattingStory,
  sortingStory,
  filteringStory,
  columnsLayoutStory,
  rowsSelectionStory,
  footerMasterDetailStory,
];
