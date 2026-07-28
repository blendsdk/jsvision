import { Commands } from '@jsvision/ui';
import { createI18nDemoSupervisor, I18N_STORIES, OFFICIAL_I18N_LOCALES } from './harness.js';
import type { I18nDemoSelection } from './harness.js';
import type { I18nDemoViewport } from './types.js';

/** Select the next item in a non-empty immutable list, wrapping at the end. */
function nextValue<T>(items: readonly T[], current: T): T {
  const index = items.indexOf(current);
  const next = items[(index + 1) % items.length];
  if (next === undefined) throw new Error('The multilingual demo selection list is empty.');
  return next;
}

/** Resolve the real interactive terminal size, retaining the headless baseline as a safe fallback. */
function terminalViewport(output: NodeJS.WriteStream = process.stdout): I18nDemoViewport {
  const width = output.columns;
  const height = output.rows;
  return {
    width: Number.isSafeInteger(width) && width > 0 ? width : 80,
    height: Number.isSafeInteger(height) && height > 0 ? height : 24,
  };
}

/** Run one application at a time and reconstruct it after locale or story commands. */
async function main(): Promise<void> {
  const firstStory = I18N_STORIES[0];
  if (firstStory === undefined) throw new Error('The multilingual story registry is empty.');
  let selection: I18nDemoSelection = { locale: 'en', storyId: firstStory.id };

  for (;;) {
    const supervisor = createI18nDemoSupervisor(selection);
    const session = await supervisor.construct({ viewport: terminalViewport() });
    let requested: I18nDemoSelection | null = null;
    session.application.onCommand('i18n-demo:next-locale', () => {
      requested = {
        locale: nextValue(OFFICIAL_I18N_LOCALES, selection.locale),
        storyId: selection.storyId,
      };
      session.application.loop.emitCommand(Commands.quit);
    });
    session.application.onCommand('i18n-demo:next-story', () => {
      const storyIds = I18N_STORIES.map(({ id }) => id);
      requested = {
        locale: selection.locale,
        storyId: nextValue(storyIds, selection.storyId),
      };
      session.application.loop.emitCommand(Commands.quit);
    });
    await session.application.run();
    await session.story.close();
    if (requested === null) return;
    selection = requested;
  }
}

await main();
