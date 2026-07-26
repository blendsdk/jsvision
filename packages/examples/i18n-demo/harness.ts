import { createKeymap } from '@jsvision/core';
import { createApplication, statusItem, statusLine } from '@jsvision/ui';
import { createFrameworkI18n, isOfficialI18nLocale, OFFICIAL_I18N_LOCALES } from './catalogs.js';
import { freshI18nStoryDefinitions, I18N_STORY_DEFINITIONS, storyDefinition } from './stories.js';
import type {
  ConstructHeadlessI18nStoryOptions,
  HeadlessI18nStory,
  I18nDemoSelection,
  I18nDemoSession,
  I18nDemoSupervisor,
  I18nDemoViewport,
  I18nStoryMetadata,
} from './types.js';

export { OFFICIAL_I18N_LOCALES };
export type {
  ActionArrangement,
  ConstructHeadlessI18nStoryOptions,
  HeadlessI18nStory,
  I18nActionSnapshot,
  I18nCellBounds,
  I18nDemoSelection,
  I18nDemoSession,
  I18nDemoSupervisor,
  I18nDemoViewport,
  I18nLayoutSnapshot,
  I18nStoryCategory,
  I18nStoryLifecycle,
  I18nStoryMetadata,
  I18nStoryViewports,
  OfficialI18nLocale,
} from './types.js';

/** Immutable public registry used for discovery; sessions receive fresh metadata copies. */
export const I18N_STORIES: readonly I18nStoryMetadata[] = Object.freeze(
  I18N_STORY_DEFINITIONS.map(({ metadata }) => metadata),
);

/**
 * Snapshot functions stay module-private so the public story lifecycle exposes only its root, state,
 * and close operation. Weak keys let completed sessions be collected without explicit bookkeeping.
 */
const SESSION_SNAPSHOTS = new WeakMap<I18nDemoSession, () => ReturnType<HeadlessI18nStory['snapshot']>>();

/** Whether an unknown value is a plain data record. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate an exact locale/story selection with no retained extra properties. */
function requestedSelection(value: unknown): I18nDemoSelection {
  if (!isRecord(value) || Object.keys(value).length !== 2 || !('locale' in value) || !('storyId' in value)) {
    throw new TypeError('A selection must contain only locale and storyId.');
  }
  if (!isOfficialI18nLocale(value.locale)) throw new RangeError('The requested locale is not supported.');
  if (typeof value.storyId !== 'string' || storyDefinition(value.storyId) === undefined) {
    throw new RangeError('The requested story is not registered.');
  }
  return Object.freeze({ locale: value.locale, storyId: value.storyId });
}

/** Validate a positive terminal-cell viewport supplied at the headless boundary. */
function validatedViewport(value: I18nDemoViewport): I18nDemoViewport {
  if (
    !Number.isSafeInteger(value.width) ||
    value.width <= 0 ||
    !Number.isSafeInteger(value.height) ||
    value.height <= 0
  ) {
    throw new RangeError('Viewport width and height must be positive safe integers.');
  }
  return Object.freeze({ width: value.width, height: value.height });
}

/** Copy opaque caller bytes so story reconstruction cannot mutate caller-owned storage. */
function copyCallerData(value: Uint8Array | undefined): Uint8Array | undefined {
  return value?.slice();
}

/** Construct one fresh session from validated serializable inputs. */
async function constructSession(
  selection: I18nDemoSelection,
  viewport: I18nDemoViewport,
  callerData?: Uint8Array,
  applicationCatalog?: Readonly<Record<string, string>>,
): Promise<I18nDemoSession> {
  const { catalogs, i18n } = await createFrameworkI18n(selection.locale, applicationCatalog);
  const definitions = freshI18nStoryDefinitions();
  const definition = definitions.find(({ metadata }) => metadata.id === selection.storyId);
  if (definition === undefined) throw new RangeError('The requested story is not registered.');
  const application = createApplication({
    viewport,
    i18n,
    keymap: createKeymap({
      'alt+l': 'i18n-demo:next-locale',
      'alt+s': 'i18n-demo:next-story',
      'alt+q': 'quit',
    }),
    statusLine: statusLine([
      statusItem(`~L~ocale ${selection.locale} (rebuild)`, 'i18n-demo:next-locale', 'Alt+L'),
      statusItem(`~S~tory ${selection.storyId}`, 'i18n-demo:next-story', 'Alt+S'),
      statusItem('~Q~uit', 'quit', 'Alt+Q'),
    ]),
  });
  let built;
  try {
    built = definition.build({ application, i18n, viewport });
  } catch (error) {
    application.loop.dispose();
    throw error;
  }
  let disposed = false;
  const close = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    try {
      built.close();
    } finally {
      application.loop.dispose();
    }
  };
  const session: I18nDemoSession = Object.freeze({
    selection,
    catalogs: Object.freeze([...catalogs]),
    i18n,
    application,
    registry: Object.freeze(definitions.map(({ metadata }) => metadata)),
    story: Object.freeze({ root: built.root, state: built.state, close }),
    callerData: copyCallerData(callerData),
    isDisposed: () => disposed,
  });
  SESSION_SNAPSHOTS.set(session, built.snapshot);
  return session;
}

/**
 * Create a supervisor whose own state contains only a validated locale and registered story ID.
 *
 * The active application is deliberately returned from `construct` instead of retained here, which
 * keeps JSON serialization small and prevents live views or signals from crossing reconstruction.
 */
export function createI18nDemoSupervisor(selection: I18nDemoSelection): I18nDemoSupervisor {
  const validated = requestedSelection(selection);
  return Object.freeze({
    selection: validated,
    construct: (options?: { readonly callerData?: Uint8Array }) =>
      constructSession(validated, { width: 80, height: 24 }, options?.callerData),
    transition: async (previous: I18nDemoSession, requested: I18nDemoSelection) => {
      const next = createI18nDemoSupervisor(requested);
      const callerData = copyCallerData(previous.callerData);
      await previous.story.close();
      const session = await next.construct({ callerData });
      return Object.freeze({ supervisor: next, session });
    },
    toJSON: () => Object.freeze({ ...validated }),
  });
}

/**
 * Restore persisted supervisor data.
 *
 * A valid locale with a stale saved story ID falls back to the first current entry. Missing fields,
 * extra fields, and invalid locales remain errors because they are not legacy story drift.
 */
export function restoreI18nDemoSupervisor(saved: unknown): I18nDemoSupervisor {
  if (!isRecord(saved) || Object.keys(saved).length !== 2 || !('locale' in saved) || !('storyId' in saved)) {
    throw new TypeError('Saved state must contain only locale and storyId.');
  }
  if (!isOfficialI18nLocale(saved.locale)) throw new RangeError('The saved locale is not supported.');
  if (typeof saved.storyId !== 'string') throw new TypeError('The saved storyId must be a string.');
  const firstStory = I18N_STORIES[0];
  if (firstStory === undefined) throw new Error('The multilingual story registry is empty.');
  return createI18nDemoSupervisor({
    locale: saved.locale,
    storyId: storyDefinition(saved.storyId) === undefined ? firstStory.id : saved.storyId,
  });
}

/** Construct one story through the same five-catalog and application path used by the demo shell. */
export async function constructHeadlessI18nStory(
  options: ConstructHeadlessI18nStoryOptions,
): Promise<HeadlessI18nStory> {
  if (!isOfficialI18nLocale(options.locale)) throw new RangeError('The requested locale is not supported.');
  const viewport = validatedViewport(options.viewport);
  const selection = requestedSelection({ locale: options.locale, storyId: options.storyId });
  const session = await constructSession(selection, viewport, options.callerData, options.applicationCatalog);
  const definition = storyDefinition(selection.storyId);
  if (definition === undefined) {
    await session.story.close();
    throw new RangeError('The requested story is not registered.');
  }
  const builtRoot = session.story.root;
  return Object.freeze({
    metadata: definition.metadata,
    snapshot: () => {
      const active = session.application.desktop?.activeWindow();
      if (active !== builtRoot) throw new Error('The story surface is no longer active.');
      return sessionSnapshot(session);
    },
    dispose: () => session.story.close(),
  });
}

/** Resolve the headless snapshot registered for a fresh session. */
function sessionSnapshot(session: I18nDemoSession): ReturnType<HeadlessI18nStory['snapshot']> {
  const snapshot = SESSION_SNAPSHOTS.get(session);
  if (snapshot === undefined) throw new Error('The session has no headless snapshot.');
  return snapshot();
}
