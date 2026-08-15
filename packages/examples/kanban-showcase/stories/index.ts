import { ACTIONS_HISTORY_STORY } from './actions-history.story.js';
import { CONFIGURATION_STORY } from './configuration.story.js';
import { DELIVERY_STORY } from './delivery.story.js';
import { EDITING_STORY } from './editing.story.js';
import { INTERACTION_STORY } from './interaction.story.js';
import { LOCALIZED_DENSITY_STORY } from './localized-density.story.js';
import { MODERN_INTERACTION_STORY } from './modern-interaction.story.js';
import { PRODUCTIVITY_STORY } from './productivity.story.js';
import { SWIMLANES_STORY } from './swimlanes.story.js';

/** Ordered permanent Kanban kitchen-sink registry; append new shipped capabilities here. */
export const KANBAN_STORIES = Object.freeze([
  DELIVERY_STORY,
  LOCALIZED_DENSITY_STORY,
  SWIMLANES_STORY,
  INTERACTION_STORY,
  MODERN_INTERACTION_STORY,
  PRODUCTIVITY_STORY,
  EDITING_STORY,
  CONFIGURATION_STORY,
  ACTIONS_HISTORY_STORY,
]);
