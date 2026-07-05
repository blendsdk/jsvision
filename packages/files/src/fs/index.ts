/**
 * The `fs/` barrel — the `FileSystem` seam + its `node:fs` default + the pure cores
 * (wildcard / scan+sort / tree). View-free, TTY-free, zero runtime deps. `.js` per NodeNext.
 */
export type { DirEntry, FileStat, FileSystem } from './types.js';
export { nodeFileSystem } from './node-fs.js';
export { isWild, wildcardMatch } from './wildcard.js';
export { scanDirectory, compareEntries } from './scan.js';
export type { ScanOptions } from './scan.js';
export { buildDirTree } from './tree.js';
export type { DirNode } from './tree.js';
