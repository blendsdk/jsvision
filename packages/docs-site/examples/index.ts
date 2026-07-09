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
export const EXAMPLES: readonly ExampleEntry[] = [];
