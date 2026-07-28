import { I18N_STORY_DEFINITIONS } from './story-definitions.js';
import type { I18nStoryDefinition, StoryBuildContext } from './story-runtime.js';
import type { I18nStoryMetadata } from './types.js';

export { I18N_STORY_DEFINITIONS } from './story-definitions.js';
export type { BuiltStory, I18nStoryDefinition, StoryBuildContext } from './story-runtime.js';

/** Clone one metadata object and all of its nested collections. */
function freshMetadata(entry: I18nStoryMetadata): I18nStoryMetadata {
  return Object.freeze({
    ...entry,
    coverage: Object.freeze([...entry.coverage]),
    viewports: Object.freeze({
      standard: Object.freeze({ ...entry.viewports.standard }),
      narrow: Object.freeze(entry.viewports.narrow.map((viewport) => Object.freeze({ ...viewport }))),
      infeasible: Object.freeze({ ...entry.viewports.infeasible }),
    }),
  });
}

/**
 * Create fresh registry entries, metadata, and builder closures for one application construction.
 *
 * Module-level definitions are immutable templates only; active sessions never retain or build
 * through those entry objects directly.
 */
export function freshI18nStoryDefinitions(): readonly I18nStoryDefinition[] {
  return I18N_STORY_DEFINITIONS.map((definition) =>
    Object.freeze({
      metadata: freshMetadata(definition.metadata),
      build: (context: StoryBuildContext) => definition.build(context),
    }),
  );
}

/** Clone registry metadata so no application shares mutable identity with another session. */
export function freshI18nStoryRegistry(): readonly I18nStoryMetadata[] {
  return freshI18nStoryDefinitions().map(({ metadata: entry }) => entry);
}

/** Resolve an internal story builder by its validated stable ID. */
export function storyDefinition(storyId: string): I18nStoryDefinition | undefined {
  return I18N_STORY_DEFINITIONS.find(({ metadata: entry }) => entry.id === storyId);
}
