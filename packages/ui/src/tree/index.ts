/**
 * `tree/` subsystem barrel (RD-15) — the public Tree/outline surface.
 *
 * Re-exports the `Tree<T>` widget + its `TreeNode<T>` / `TreeOptions<T>` types. The `TreeRows`
 * renderer and the pure `graph.ts` builder stay internal (imported directly by tests when needed).
 * `.js` specifiers per NodeNext.
 */
export { Tree } from './tree.js';
export type { TreeNode, TreeOptions } from './tree.js';
