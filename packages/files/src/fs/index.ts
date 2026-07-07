/**
 * Filesystem building blocks: the injectable {@link FileSystem} interface, its Node-backed default
 * {@link nodeFileSystem}, and the pure helpers the dialogs build on — wildcard matching, directory
 * scanning/sorting, and directory-tree geometry. All view-free and terminal-free.
 */
export type { DirEntry, FileStat, FileSystem } from './types.js';
export { nodeFileSystem } from './node-fs.js';
export { isWild, wildcardMatch } from './wildcard.js';
export { scanDirectory, compareEntries } from './scan.js';
export type { ScanOptions } from './scan.js';
export { buildDirTree } from './tree.js';
export type { DirNode } from './tree.js';
