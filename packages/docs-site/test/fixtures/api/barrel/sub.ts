// A sub-module reached only through the barrel's `export * from './sub.js'` — its
// exports must be followed transitively by barrelExports().

/** Public member C, reached via `export *`. */
export const C = 'c';
