/** Specification oracle for the four permanent Phase D Kanban showcase stories. */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveCapabilities } from '@jsvision/ui';
import { afterEach, describe, expect, it } from 'vitest';

import { createKanbanShowcase } from '../kanban-showcase/shell.js';
import { KANBAN_STORIES } from '../kanban-showcase/stories/index.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const PHASE_D_STORIES = Object.freeze([
  'kanban/productivity',
  'kanban/editing',
  'kanban/configuration',
  'kanban/actions-history',
]);
const disposeApps: (() => void)[] = [];
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, '../..');
const SUPPORTED_KANBAN_IMPORTS = /^@jsvision\/kanban(?:\/testing|\/locales\/(?:en|nl|de|fr|es|it|pt-PT|pl|ro|sv))?$/u;

afterEach(() => {
  for (const dispose of disposeApps.splice(0)) dispose();
});

/** Returns the complete visible terminal text for one selected story. */
function screen(showcase: ReturnType<typeof createKanbanShowcase>): string {
  showcase.app.loop.renderRoot.flush();
  return showcase.app.loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Lists showcase source modules without following symlinks or leaving the bounded example roots. */
function exampleSourceFiles(): readonly string[] {
  const files: string[] = [];
  for (const root of ['kanban-showcase', 'github-project-kanban']) {
    const pending = [join(PACKAGE_ROOT, root)];
    while (pending.length > 0) {
      const directory = pending.shift();
      if (directory === undefined) continue;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) pending.push(path);
        else if (entry.isFile() && path.endsWith('.ts')) files.push(path);
      }
    }
  }
  return files.sort();
}

/** Extracts literal JSVision Kanban imports from one TypeScript example module. */
function kanbanImports(path: string): readonly string[] {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/(?:from\s*|import\s*)["'](@jsvision\/kanban[^"']*)["']/gu)].flatMap((match) =>
    match[1] === undefined ? [] : [match[1]],
  );
}

describe('Phase D permanent Kanban stories', () => {
  it('uses only supported public Kanban package entry points in permanent showcases', () => {
    const imports = exampleSourceFiles().flatMap((path) => kanbanImports(path));
    expect(imports.length).toBeGreaterThan(0);
    for (const specifier of imports) {
      expect(specifier, `unsupported Kanban import ${specifier}`).toMatch(SUPPORTED_KANBAN_IMPORTS);
    }
  });

  it('keeps the Examples workspace aligned for built Kanban import and smoke verification', () => {
    const manifest = JSON.parse(readFileSync(join(PACKAGE_ROOT, 'package.json'), 'utf8')) as {
      readonly scripts?: Readonly<Record<string, string>>;
      readonly dependencies?: Readonly<Record<string, string>>;
    };
    const workspace = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
      readonly version?: string;
    };

    expect(manifest.dependencies).toMatchObject({
      '@jsvision/forms': workspace.version,
      '@jsvision/kanban': workspace.version,
      zod: expect.stringMatching(/^\^4\./u),
    });
    expect(manifest.scripts).toMatchObject({
      typecheck: 'tsc --noEmit',
      test: 'vitest run --project unit',
      'test:e2e': 'vitest run --project e2e',
      'demo:kanban': 'tsx kanban-showcase/main.ts',
      'demo:github-kanban': 'tsx github-project-kanban/main.ts',
    });
    expect(manifest.scripts?.build).toBeUndefined();
  });

  it('registers the four distinct productivity workflows in stable order', () => {
    const ids = KANBAN_STORIES.map(({ id }) => id);
    expect(ids.filter((id) => PHASE_D_STORIES.includes(id))).toEqual(PHASE_D_STORIES);
    for (const id of PHASE_D_STORIES) {
      const story = KANBAN_STORIES.find((entry) => entry.id === id);
      expect(story?.blurb).toMatch(/try|edit|filter|configure|action|history/iu);
    }
  });

  it.each(PHASE_D_STORIES)('mounts %s at 80x24 with a live action surface and visible feedback', (id) => {
    const showcase = createKanbanShowcase(CAPS, { width: 80, height: 24 });
    disposeApps.push(() => showcase.app.loop.dispose());
    const index = KANBAN_STORIES.findIndex((story) => story.id === id);
    expect(index).toBeGreaterThanOrEqual(0);
    showcase.selectStory(index);
    const board = showcase.activeBoard();
    const getter: unknown = Reflect.get(board, 'actions');

    expect(board.inspection().visibleCards.length).toBeGreaterThan(0);
    expect(screen(showcase)).toMatch(/Alt-X|Tab|Mouse/u);
    expect(getter).toBeTypeOf('function');
    if (typeof getter !== 'function') throw new Error('Missing Phase D story action surface.');
    expect(Reflect.apply(getter, board, [])).toBeDefined();
    expect(showcase.activeActivity()).toBeTruthy();
  });
});
