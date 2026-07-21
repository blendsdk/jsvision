/**
 * The live-example registry: one entry per runnable example module under
 * `examples/<category>/<name>.ts`. Hand-authored — the single source of truth
 * for each example's id, category, kind, and source path. A parity test keeps
 * it honest: every module file must have exactly one entry and vice-versa.
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
  /**
   * What the example's `build()` returns, which selects how the demo shell hosts it:
   * `'component'` (a bare `View`, wrapped in a stage window) or `'app'` (a whole `Application`).
   */
  readonly kind: 'component' | 'app';
  /** Package-root-relative path to the module (`'examples/controls/button.ts'`) — the `<<<` embed + parity target. */
  readonly sourcePath: string;
  /**
   * Show the `View ▸ Theme` preset submenu in this example's chrome. Off by default — a theme
   * switcher distracts from the component an example exists to show — so only an example that is
   * itself about theming asks for it. Read for a `component` example, whose chrome the demo shell
   * owns; an `app` example builds its own menu bar and passes the flag to `demoApp` instead.
   */
  readonly themeMenu?: boolean;
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
    kind: 'component',
    sourcePath: 'examples/controls/button.ts',
    load: () => import('./controls/button.js'),
  },
  {
    id: 'controls/input',
    category: 'controls',
    kind: 'component',
    sourcePath: 'examples/controls/input.ts',
    load: () => import('./controls/input.js'),
  },
  {
    id: 'controls/form-dialog',
    category: 'controls',
    kind: 'app',
    sourcePath: 'examples/controls/form-dialog.ts',
    load: () => import('./controls/form-dialog.js'),
  },
  {
    id: 'containers/list-box',
    category: 'containers',
    kind: 'component',
    sourcePath: 'examples/containers/list-box.ts',
    load: () => import('./containers/list-box.js'),
  },
  {
    id: 'files/file-dialog',
    category: 'files',
    kind: 'app',
    sourcePath: 'examples/files/file-dialog.ts',
    load: () => import('./files/file-dialog.js'),
  },
  {
    id: 'table/data-grid',
    category: 'table',
    kind: 'component',
    sourcePath: 'examples/table/data-grid.ts',
    load: () => import('./table/data-grid.js'),
  },
  {
    id: 'apps/hello',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/hello.ts',
    load: () => import('./apps/hello.js'),
  },
  {
    id: 'apps/editor',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/editor.ts',
    load: () => import('./apps/editor.js'),
  },
  {
    id: 'apps/amiga-clock',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/amiga-clock.ts',
    load: () => import('./apps/amiga-clock.js'),
  },
  {
    id: 'apps/matrix',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/matrix.ts',
    load: () => import('./apps/matrix.js'),
  },
  {
    id: 'apps/desktop',
    category: 'apps',
    kind: 'app',
    sourcePath: 'examples/apps/desktop.ts',
    load: () => import('./apps/desktop.js'),
  },
  {
    id: 'theming/preset-gallery',
    category: 'theming',
    kind: 'component',
    themeMenu: true, // the gallery IS the theme switcher's demo — the only example that shows it
    sourcePath: 'examples/theming/preset-gallery.ts',
    load: () => import('./theming/preset-gallery.js'),
  },
];
