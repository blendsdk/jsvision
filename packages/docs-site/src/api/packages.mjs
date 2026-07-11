// The four documented packages — the single list shared by the generator and the
// build gate. `entry` and `tsconfig` are relative to the docs-site package root.

/**
 * @typedef {object} DocPackage
 * @property {'core' | 'ui' | 'files' | 'web'} name  Unscoped package name (and its api/<name>/ dir).
 * @property {string} entry     Public entry point, relative to the docs-site root.
 * @property {string} tsconfig  The package's tsconfig, relative to the docs-site root.
 */

/** @type {DocPackage[]} */
export const PACKAGES = [
  { name: 'core', entry: '../core/src/engine/index.ts', tsconfig: '../core/tsconfig.json' },
  { name: 'ui', entry: '../ui/src/index.ts', tsconfig: '../ui/tsconfig.json' },
  { name: 'files', entry: '../files/src/index.ts', tsconfig: '../files/tsconfig.json' },
  { name: 'web', entry: '../web/src/index.ts', tsconfig: '../web/tsconfig.json' },
];
