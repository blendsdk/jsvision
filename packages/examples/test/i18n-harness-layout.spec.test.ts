/**
 * Immutable layout oracle for the dedicated multilingual QA harness.
 *
 * These expectations use only stable registry metadata and headless snapshots. They deliberately
 * avoid private widget fields so the interactive demo and CI exercise the same construction path.
 */
import { expect, test } from 'vitest';

const HARNESS_MODULE = '../i18n-demo/harness.js';
const OFFICIAL_LOCALES = ['en', 'nl', 'de', 'fr', 'es', 'it', 'pt-PT', 'pl', 'ro', 'sv'] as const;
const STANDARD_VIEWPORT = Object.freeze({ width: 80, height: 24 });

/** One rectangular terminal-cell region exposed by the headless inspection API. */
interface CellBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Stable action evidence needed to prove keyboard and pointer reachability. */
interface ActionSnapshot {
  readonly id: string;
  readonly label: string;
  readonly naturalWidth: number;
  readonly bounds: CellBounds;
  readonly hitBounds: CellBounds;
  readonly focusIndex: number;
  readonly command: string | null;
  readonly hasCallback: boolean;
  readonly activation: 'command' | 'callback' | 'command-and-callback' | 'none';
}

/** Public render evidence returned by a constructed story. */
interface LayoutSnapshot {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly surfaces: readonly CellBounds[];
  readonly descendants: readonly CellBounds[];
  readonly overlaySurfaces: readonly CellBounds[];
  readonly overlayDescendants: readonly CellBounds[];
  readonly actions: readonly ActionSnapshot[];
  readonly rows: readonly string[];
  readonly cellChars: readonly (readonly string[])[];
  readonly cellWidths: readonly (readonly number[])[];
  readonly arrangement: 'single' | 'pair' | 'one-row' | 'wrapped' | 'vertical';
}

/** Supported viewport declarations are data, allowing the matrix to stay registry-driven. */
interface ViewportMetadata {
  readonly standard: { readonly width: 80; readonly height: 24 };
  readonly narrow: readonly { readonly width: number; readonly height: number }[];
  readonly infeasible: { readonly width: number; readonly height: number };
}

/** Public story metadata consumed by both the shell and headless oracle. */
interface StoryMetadata {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly coverage: readonly string[];
  readonly viewports: ViewportMetadata;
}

/** Disposable result of constructing one story with fresh framework state. */
interface HeadlessStory {
  readonly metadata: StoryMetadata;
  snapshot(): LayoutSnapshot;
  dispose(): Promise<void>;
}

/** Contract surface exported by the multilingual harness module. */
interface HarnessModule {
  readonly I18N_STORIES: readonly StoryMetadata[];
  constructHeadlessI18nStory(options: {
    readonly locale: string;
    readonly storyId: string;
    readonly viewport: { readonly width: number; readonly height: number };
    readonly applicationCatalog?: Readonly<Record<string, string>>;
    readonly callerData?: Uint8Array;
  }): Promise<HeadlessStory>;
}

/** Load the not-yet-implemented harness without making the red oracle fail during collection. */
async function loadHarness(): Promise<HarnessModule> {
  return import(HARNESS_MODULE);
}

/** Whether an inner terminal-cell rectangle is wholly contained by an outer rectangle. */
function contains(outer: CellBounds, inner: CellBounds): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** Assert feasible layout, focus, and hit-test invariants for one public snapshot. */
function expectFeasibleSnapshot(snapshot: LayoutSnapshot): void {
  const viewport: CellBounds = { x: 0, y: 0, ...snapshot.viewport };
  expect(snapshot.surfaces.length).toBeGreaterThan(0);
  for (const surface of snapshot.surfaces) expect(contains(viewport, surface), 'surface bounds').toBe(true);
  for (const descendant of snapshot.descendants) {
    expect(
      snapshot.surfaces.some((surface) => contains(surface, descendant)),
      'descendant bounds',
    ).toBe(true);
  }

  const focusOrder = snapshot.actions.map((action) => action.focusIndex);
  expect(new Set(focusOrder).size, 'unique action focus positions').toBe(focusOrder.length);
  expect([...focusOrder].sort((left, right) => left - right)).toEqual(
    Array.from({ length: focusOrder.length }, (_, index) => index),
  );
  for (const action of snapshot.actions) {
    expect(action.bounds.width, `${action.id} natural width`).toBeGreaterThanOrEqual(action.naturalWidth);
    expect(action.hitBounds, `${action.id} clickable face`).toEqual({
      x: action.bounds.x + 1,
      y: action.bounds.y,
      width: Math.max(0, action.bounds.width - 2),
      height: Math.max(0, action.bounds.height - 1),
    });
    expect(
      snapshot.surfaces.some((surface) => contains(surface, action.bounds)),
      `${action.id} bounds`,
    ).toBe(true);
    const expectedActivation =
      action.command !== null && action.hasCallback
        ? 'command-and-callback'
        : action.command !== null
          ? 'command'
          : action.hasCallback
            ? 'callback'
            : 'none';
    expect(action.activation, `${action.id} actual activation shape`).toBe(expectedActivation);
    expect(action.label, `${action.id} visible label`).not.toBe('');
  }
}

// Every official locale must exercise every registered story through the same five-catalog,
// fresh-construction path at the standard 80×24 terminal size.
test.each(OFFICIAL_LOCALES)('keeps every multilingual story functional at 80×24 for %s', async (locale) => {
  const harness = await loadHarness();
  expect(harness.I18N_STORIES.length).toBeGreaterThan(0);
  for (const story of harness.I18N_STORIES) {
    const mounted = await harness.constructHeadlessI18nStory({
      locale,
      storyId: story.id,
      viewport: STANDARD_VIEWPORT,
    });
    expect(mounted.metadata).toEqual(story);
    expectFeasibleSnapshot(mounted.snapshot());
    await mounted.dispose();
  }
});

// Each component declares its own smallest functional viewport. Those boundaries must remain fully
// reachable instead of being replaced by one misleading global minimum.
test('keeps every story functional at each declared narrow boundary', async () => {
  const harness = await loadHarness();
  for (const story of harness.I18N_STORIES) {
    expect(story.viewports.narrow.length, `${story.id} narrow boundaries`).toBeGreaterThan(0);
    for (const viewport of story.viewports.narrow) {
      const mounted = await harness.constructHeadlessI18nStory({ locale: 'de', storyId: story.id, viewport });
      expectFeasibleSnapshot(mounted.snapshot());
      await mounted.dispose();
    }
  }
});

// An opened dropdown is mounted in the application overlay rather than under the story dialog. Its
// full overlay lifecycle must still be represented in the public geometry contract.
test('includes the opened dropdown overlay and its descendants in UI surface geometry', async () => {
  const harness = await loadHarness();
  const story = harness.I18N_STORIES.find(
    (candidate) => candidate.category === 'ui' && candidate.coverage.includes('popup'),
  );
  expect(story, 'UI popup story').toBeDefined();
  if (story === undefined) return;

  const mounted = await harness.constructHeadlessI18nStory({
    locale: 'de',
    storyId: story.id,
    viewport: STANDARD_VIEWPORT,
  });
  const snapshot = mounted.snapshot();
  expect(snapshot.overlaySurfaces).toEqual([{ x: 0, y: 0, ...STANDARD_VIEWPORT }]);
  expect(snapshot.overlayDescendants).toContainEqual({ x: 0, y: 0, ...STANDARD_VIEWPORT });
  expect(snapshot.overlayDescendants.some((bounds) => bounds.width < STANDARD_VIEWPORT.width)).toBe(true);
  await mounted.dispose();
});

// Below a declared hard bound, clipping remains deterministic and never leaves the continuation
// half of a wide glyph without its leading cell.
test('clips deterministically without splitting wide glyphs at each infeasible hard bound', async () => {
  const harness = await loadHarness();
  for (const story of harness.I18N_STORIES) {
    const options = { storyId: story.id, viewport: story.viewports.infeasible };
    const first = await harness.constructHeadlessI18nStory({
      ...options,
      locale: 'en',
      applicationCatalog: { 'ui.action.ok': '~確~認✅', 'ui.action.cancel': 'e\u0301e\u0301取消' },
    });
    const second = await harness.constructHeadlessI18nStory({
      ...options,
      locale: 'en',
      applicationCatalog: { 'ui.action.ok': '~確~認✅', 'ui.action.cancel': 'e\u0301e\u0301取消' },
    });
    const firstRows = first.snapshot().rows;
    const firstChars = first.snapshot().cellChars;
    const firstWidths = first.snapshot().cellWidths;
    expect(second.snapshot().rows).toEqual(firstRows);
    expect(second.snapshot().cellChars).toEqual(firstChars);
    expect(second.snapshot().cellWidths).toEqual(firstWidths);
    for (const row of firstRows) {
      expect(row).not.toContain('\u0000');
    }
    for (const [rowIndex, widths] of firstWidths.entries()) {
      const chars = firstChars[rowIndex] ?? [];
      for (let x = 0; x < widths.length; x += 1) {
        const width = widths[x];
        if (width === 2) expect(widths[x + 1], `wide continuation at ${rowIndex}:${x}`).toBe(0);
        if (width === 0) expect(widths[x - 1], `wide leader at ${rowIndex}:${x}`).toBe(2);
        const glyph = chars[x];
        if (glyph !== undefined) expect(glyph).not.toMatch(/^\p{Mark}/u);
      }
    }
    await first.dispose();
    await second.dispose();
  }
});

// Long application overrides, malformed accelerators, wide glyphs, and combining sequences cover
// all supported action arrangements without changing order, commands, focus, or hit geometry.
test.each(['single', 'pair', 'one-row', 'wrapped', 'vertical'] as const)(
  'preserves action semantics for %s stress captions',
  async (arrangement) => {
    const harness = await loadHarness();
    const story = harness.I18N_STORIES.find(
      (candidate) => candidate.category === 'standard-actions' && candidate.coverage.includes(arrangement),
    );
    expect(story, `${arrangement} standard-action story`).toBeDefined();
    if (story === undefined) return;

    const baseline = await harness.constructHeadlessI18nStory({
      locale: 'en',
      storyId: story.id,
      viewport: STANDARD_VIEWPORT,
    });
    const stressed = await harness.constructHeadlessI18nStory({
      locale: 'en',
      storyId: story.id,
      viewport: STANDARD_VIEWPORT,
      applicationCatalog: {
        'ui.action.ok': '~C~onfirm this unusually long operation 確認',
        'ui.action.cancel': '~D~i\u0301smiss this unusually long operation',
        'ui.action.yes': '~Y~es, apply the complete selection',
        'ui.action.no': '~N~o, retain the caller-owned selection',
        'ui.action.close': '~B~roken ~accelerator',
      },
    });
    const before = baseline.snapshot();
    const after = stressed.snapshot();
    expectFeasibleSnapshot(after);
    expect(after.arrangement).toBe(arrangement);
    expect(after.actions.map(({ id }) => id)).toEqual(before.actions.map(({ id }) => id));
    expect(after.actions.map(({ command }) => command)).toEqual(before.actions.map(({ command }) => command));
    expect(after.actions.map(({ focusIndex }) => focusIndex)).toEqual(
      before.actions.map(({ focusIndex }) => focusIndex),
    );
    await baseline.dispose();
    await stressed.dispose();
  },
);
