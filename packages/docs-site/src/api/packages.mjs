// The documented packages — the single list shared by the generator and the build
// gate. It is exactly the publishable set (core, i18n, ui, files, forms, datagrid, code-editor,
// kanban); the
// private browser runtime `@jsvision/web` powers the site's live examples but is not
// itself a product package, so it is not documented here. `entry` and `tsconfig` are
// relative to the docs-site package root.

/**
 * @typedef {object} DocPackage
 * @property {'core' | 'i18n' | 'ui' | 'files' | 'forms' | 'datagrid' | 'code-editor' | 'kanban'} name  Unscoped package name (and its api/<name>/ dir).
 * @property {string} entry     Public entry point, relative to the docs-site root.
 * @property {string} tsconfig  The package's tsconfig, relative to the docs-site root.
 */

/** @type {DocPackage[]} */
export const PACKAGES = [
  { name: 'core', entry: '../core/src/engine/index.ts', tsconfig: '../core/tsconfig.json' },
  { name: 'i18n', entry: '../i18n/src/index.ts', tsconfig: '../i18n/tsconfig.json' },
  { name: 'ui', entry: '../ui/src/index.ts', tsconfig: '../ui/tsconfig.json' },
  { name: 'files', entry: '../files/src/index.ts', tsconfig: '../files/tsconfig.json' },
  { name: 'forms', entry: '../forms/src/index.ts', tsconfig: '../forms/tsconfig.json' },
  { name: 'datagrid', entry: '../datagrid/src/index.ts', tsconfig: '../datagrid/tsconfig.json' },
  {
    name: 'code-editor',
    entry: '../code-editor/src/index.ts',
    tsconfig: '../code-editor/tsconfig.json',
  },
  { name: 'kanban', entry: '../kanban/src/index.ts', tsconfig: '../kanban/tsconfig.json' },
];
