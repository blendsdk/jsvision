import { DELIVERY_STORY } from './delivery.story.js';
import { INTERACTION_STORY } from './interaction.story.js';
import { LOCALIZED_DENSITY_STORY } from './localized-density.story.js';
import { SWIMLANES_STORY } from './swimlanes.story.js';

/** Ordered permanent Kanban kitchen-sink registry; append new shipped capabilities here. */
export const KANBAN_STORIES = Object.freeze([
  DELIVERY_STORY,
  LOCALIZED_DENSITY_STORY,
  SWIMLANES_STORY,
  INTERACTION_STORY,
]);
