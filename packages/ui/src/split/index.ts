/**
 * Split panes — a resizable split-pane container: N panes divided by N−1 draggable 1-cell splitters,
 * row or column, nestable for grids.
 *
 * Public surface: the {@link SplitView} class and its {@link SplitViewOptions}. The pure resize helper
 * and the `Splitter` divider view stay module-private (the layout/pack-row precedent).
 */
export { SplitView } from './split-view.js';
export type { SplitViewOptions } from './split-view.js';
