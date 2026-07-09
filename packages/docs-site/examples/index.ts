/**
 * The live-example registry: one entry per runnable example module under
 * `examples/<category>/<name>.ts`. Hand-authored — the single source of truth
 * for each example's id, category, chrome mode, and source path. A parity test
 * keeps it honest: every module file must have exactly one entry and vice-versa.
 *
 * The module itself owns only `title`/`blurb`/`build` (the example contract);
 * everything about placement lives here.
 */
import type { ExampleDefinition } from './_contract.js';

/** A registry row: the placement metadata for one example module. */
export interface ExampleEntry {
  /** Unique, stable id (`'controls/button'`) — also the deep-link key and menu command name. */
  readonly id: string;
  /** Category grouping (`'controls'`). */
  readonly category: string;
  /** Which demo-shell chrome wraps this example when it runs. */
  readonly chrome: 'minimal' | 'full';
  /** Package-root-relative path to the module (`'examples/controls/button.ts'`) — the `<<<` embed + parity target. */
  readonly sourcePath: string;
  /** Lazy dynamic import so each example is a separate code-split chunk (never in the initial bundle). */
  load(): Promise<{ default: ExampleDefinition }>;
}

/**
 * The registered examples. One line per example — the seed set is filled in as
 * the example modules land. Each `load()` is a dynamic `import()` so the example
 * is code-split out of the initial page bundle.
 */
export const EXAMPLES: readonly ExampleEntry[] = [
  {
    id: 'controls/button',
    category: 'controls',
    chrome: 'minimal',
    sourcePath: 'examples/controls/button.ts',
    load: () => import('./controls/button.js'),
  },
  {
    id: 'controls/input',
    category: 'controls',
    chrome: 'minimal',
    sourcePath: 'examples/controls/input.ts',
    load: () => import('./controls/input.js'),
  },
  {
    id: 'controls/form-dialog',
    category: 'controls',
    chrome: 'full',
    sourcePath: 'examples/controls/form-dialog.ts',
    load: () => import('./controls/form-dialog.js'),
  },
  {
    id: 'containers/list-box',
    category: 'containers',
    chrome: 'minimal',
    sourcePath: 'examples/containers/list-box.ts',
    load: () => import('./containers/list-box.js'),
  },
  {
    id: 'files/file-dialog',
    category: 'files',
    chrome: 'full',
    sourcePath: 'examples/files/file-dialog.ts',
    load: () => import('./files/file-dialog.js'),
  },
  {
    id: 'table/data-grid',
    category: 'table',
    chrome: 'full',
    sourcePath: 'examples/table/data-grid.ts',
    load: () => import('./table/data-grid.js'),
  },
  {
    id: 'apps/desktop',
    category: 'apps',
    chrome: 'full',
    sourcePath: 'examples/apps/desktop.ts',
    load: () => import('./apps/desktop.js'),
  },
  {
    id: 'theming/preset-gallery',
    category: 'theming',
    chrome: 'full',
    sourcePath: 'examples/theming/preset-gallery.ts',
    load: () => import('./theming/preset-gallery.js'),
  },
];
